import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups, picks } from "@/db/schema";
import { GroupSummary, UserGroup } from "@/lib/types";

export const ACTIVE_GROUP_COOKIE = "active_group";

export const ACTIVE_GROUP_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

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
    .select({ id: groups.id, name: groups.name, memberCount: count(groupMembers.userId) })
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
// copyPicksFrom the creator starts the group with an empty bracket.
export async function createGroup(
  userId: string,
  name: string,
  copyPicksFrom?: string,
  database: Pick<typeof db, "transaction"> = db,
): Promise<UserGroup | null> {
  return database.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ name, createdBy: userId })
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

// Adds the user as a member. Returns null when the group does not exist;
// joining a group the user already belongs to keeps their existing role and
// picks. Without copyPicksFrom a new member starts with an empty bracket.
export async function joinGroup(
  userId: string,
  groupId: string,
  copyPicksFrom?: string,
  database: Pick<typeof db, "transaction"> = db,
): Promise<UserGroup | null> {
  return database.transaction(async (tx) => {
    const [group] = await tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, groupId));
    if (!group) return null;

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

// Reads the optional `copyPicksFrom` group ID from a create/join request body.
export function parseCopyPicksFrom(body: unknown): string | undefined | null {
  if (!body || typeof body !== "object" || !("copyPicksFrom" in body))
    return undefined;
  const value = body.copyPicksFrom;
  if (value === null || value === undefined) return undefined;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}
