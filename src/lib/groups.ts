import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, groupMembers, groups, picks, teams, user } from "@/db/schema";
import {
  BracketChoice,
  GROUP_PIN_PATTERN,
  GroupSummary,
  PickSource,
  UserGroup,
} from "@/lib/types";

export const ACTIVE_GROUP_COOKIE = "active_group";

export const ACTIVE_GROUP_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

// The login session the active group was chosen in. A new session with more
// than one group asks the user to choose again.
export const ACTIVE_GROUP_SESSION_COOKIE = "active_group_session";

// Makes groupId the active group and records that it was chosen in this
// login session.
export function setActiveGroupCookies(
  cookieStore: {
    set(
      name: string,
      value: string,
      options: typeof ACTIVE_GROUP_COOKIE_OPTIONS,
    ): unknown;
  },
  groupId: string,
  sessionId: string,
) {
  cookieStore.set(ACTIVE_GROUP_COOKIE, groupId, ACTIVE_GROUP_COOKIE_OPTIONS);
  cookieStore.set(
    ACTIVE_GROUP_SESSION_COOKIE,
    sessionId,
    ACTIVE_GROUP_COOKIE_OPTIONS,
  );
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The cookie only ever selects among the user's own memberships, so a stale
// or forged value falls back to their first group.
export function resolveActiveGroup(
  groups: UserGroup[],
  activeGroupId: string | undefined,
): UserGroup | null {
  return groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;
}

export async function listGroups(
  database: Pick<typeof db, "select"> = db,
): Promise<GroupSummary[]> {
  return database
    .select({
      id: groups.id,
      name: groups.name,
      memberCount: count(groupMembers.userId),
      isPrivate: groups.isPrivate,
    })
    .from(groups)
    .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.name));
}

export async function listUserGroups(
  userId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<UserGroup[]> {
  return database
    .select({ id: groups.id, name: groups.name, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name));
}

export async function findUserGroup(
  userId: string,
  groupId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<UserGroup | null> {
  const [group] = await database
    .select({ id: groups.id, name: groups.name, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    );
  return group ?? null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Starts the user's bracket in a group as a copy of their bracket in another
// group. Only the user's own picks are read, and those exist only for groups
// they still belong to, so a foreign or stale source copies nothing.
async function copyPicks(
  tx: Transaction,
  userId: string,
  fromGroupId: string,
  toGroupId: string,
) {
  const rows = await tx
    .select({ gameId: picks.gameId, winnerTeamId: picks.winnerTeamId })
    .from(picks)
    .where(and(eq(picks.userId, userId), eq(picks.groupId, fromGroupId)));
  if (!rows.length) return;
  await tx
    .insert(picks)
    .values(rows.map((row) => ({ ...row, userId, groupId: toGroupId })))
    .onConflictDoNothing();
}

// Creates the group and makes its creator the admin. Returns null when the
// name is already taken (names are unique regardless of case). Without
// copyPicksFrom the creator starts the group with an empty bracket. A
// joinPin makes the group private: others must enter it to join.
export async function createGroup(
  userId: string,
  name: string,
  copyPicksFrom?: string,
  joinPin?: string,
  database: Pick<typeof db, "transaction"> = db,
): Promise<UserGroup | null> {
  return database.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({
        name,
        createdBy: userId,
        isPrivate: joinPin !== undefined,
        joinPin: joinPin ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: groups.id, name: groups.name });
    if (!group) return null;

    await tx.insert(groupMembers).values({
      groupId: group.id,
      userId,
      role: "admin",
    });
    if (copyPicksFrom) await copyPicks(tx, userId, copyPicksFrom, group.id);
    return { ...group, role: "admin" };
  });
}

// Adds the user as a member. Returns null when the group does not exist and
// "wrong-pin" when a private group's PIN does not match; joining a group the
// user already belongs to keeps their existing role and picks and needs no
// PIN. Without copyPicksFrom a new member starts with an empty bracket.
export async function joinGroup(
  userId: string,
  groupId: string,
  copyPicksFrom?: string,
  pin?: string,
  database: Pick<typeof db, "transaction"> = db,
): Promise<UserGroup | "wrong-pin" | null> {
  return database.transaction(async (tx) => {
    const [found] = await tx
      .select({
        id: groups.id,
        name: groups.name,
        isPrivate: groups.isPrivate,
        joinPin: groups.joinPin,
      })
      .from(groups)
      .where(eq(groups.id, groupId));
    if (!found) return null;
    const group = { id: found.id, name: found.name };

    if (found.isPrivate && pin !== found.joinPin) {
      const [membership] = await tx
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
        );
      return membership ? { ...group, role: membership.role } : "wrong-pin";
    }

    const [joined] = await tx
      .insert(groupMembers)
      .values({ groupId, userId, role: "member" })
      .onConflictDoNothing()
      .returning({ role: groupMembers.role });
    if (joined) {
      if (copyPicksFrom && copyPicksFrom !== groupId)
        await copyPicks(tx, userId, copyPicksFrom, groupId);
      return { ...group, role: joined.role };
    }

    const [membership] = await tx
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
      );
    return { ...group, role: membership.role };
  });
}

// Counts the user's picks in each group for the current tournament.
async function pickCountsByGroup(
  userId: string,
  database: Pick<typeof db, "select">,
): Promise<Map<string, number>> {
  const rows = await database
    .select({ groupId: picks.groupId, pickCount: count() })
    .from(picks)
    .innerJoin(games, eq(picks.gameId, games.id))
    .where(
      and(
        eq(picks.userId, userId),
        eq(games.year, sql`(select max(${games.year}) from ${games})`),
      ),
    )
    .groupBy(picks.groupId);
  return new Map(rows.map((row) => [row.groupId, row.pickCount]));
}

// The user's groups with a summary of their bracket in each, for choosing
// which group to show after signing in.
export async function listBracketChoices(
  userId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<BracketChoice[]> {
  const [userGroups, countByGroup, champions] = await Promise.all([
    listUserGroups(userId, database),
    pickCountsByGroup(userId, database),
    database
      .select({ groupId: picks.groupId, champion: teams.name })
      .from(picks)
      .innerJoin(games, eq(picks.gameId, games.id))
      .innerJoin(teams, eq(picks.winnerTeamId, teams.id))
      .where(
        and(
          eq(picks.userId, userId),
          eq(games.round, "Championship"),
          eq(games.year, sql`(select max(${games.year}) from ${games})`),
        ),
      ),
  ]);
  const championByGroup = new Map(
    champions.map((row) => [row.groupId, row.champion]),
  );
  return userGroups.map((group) => ({
    ...group,
    pickCount: countByGroup.get(group.id) ?? 0,
    champion: championByGroup.get(group.id) ?? null,
  }));
}

// When the user has no picks yet in groupId, lists their other groups whose
// bracket they could start from. Empty when groupId already has picks.
export async function pickSourcesFor(
  userId: string,
  groupId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<PickSource[]> {
  const [userGroups, countByGroup] = await Promise.all([
    listUserGroups(userId, database),
    pickCountsByGroup(userId, database),
  ]);
  if (countByGroup.get(groupId)) return [];
  return userGroups
    .filter((group) => group.id !== groupId && countByGroup.get(group.id))
    .map((group) => ({
      id: group.id,
      name: group.name,
      pickCount: countByGroup.get(group.id)!,
    }));
}

// Starts the user's empty bracket in toGroupId from their bracket in
// fromGroupId. Refuses to merge into a group that already has picks.
export async function copyPicksIntoEmptyGroup(
  userId: string,
  fromGroupId: string,
  toGroupId: string,
  database: Pick<typeof db, "transaction"> = db,
): Promise<"copied" | "not-member" | "not-empty" | "no-source"> {
  return database.transaction(async (tx) => {
    // Serialize with pick edits, which lock the same row.
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!(await findUserGroup(userId, toGroupId, tx))) return "not-member";
    // Picks exist only for memberships, so a counted source is one of the
    // user's groups.
    const countByGroup = await pickCountsByGroup(userId, tx);
    if (countByGroup.get(toGroupId)) return "not-empty";
    if (fromGroupId === toGroupId || !countByGroup.get(fromGroupId))
      return "no-source";
    await copyPicks(tx, userId, fromGroupId, toGroupId);
    return "copied";
  });
}

// Reads the optional `pin` from a create/join request body. Returns null when
// it is present but not GROUP_PIN_PATTERN digits.
export function parsePin(body: unknown): string | undefined | null {
  if (!body || typeof body !== "object" || !("pin" in body)) return undefined;
  const value = body.pin;
  if (value === null || value === undefined) return undefined;
  return typeof value === "string" && GROUP_PIN_PATTERN.test(value)
    ? value
    : null;
}

// Reads the optional `copyPicksFrom` group ID from a create/join request body.
export function parseCopyPicksFrom(body: unknown): string | undefined | null {
  if (!body || typeof body !== "object" || !("copyPicksFrom" in body))
    return undefined;
  const value = body.copyPicksFrom;
  if (value === null || value === undefined) return undefined;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}
