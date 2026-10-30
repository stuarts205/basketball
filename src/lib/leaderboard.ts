import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brackets, games, picks, teams, user } from "@/db/schema";
import { listGroups, listUserGroups, resolveActiveGroup } from "@/lib/groups";
import { buildBracket } from "@/lib/load-bracket";
import { scoreBracket } from "@/lib/scoring";
import { applyResults } from "@/lib/simulate";
import { DEFAULT_BRACKET_NAME, GroupSummary } from "@/lib/types";

export type LeaderboardEntry = {
  userId: string;
  userName: string;
  bracketNumber: number;
  bracketName: string;
  points: number;
  maxPoints: number;
  playedPoints: number;
};

// The group whose standings a viewer sees. Players see their active group.
// The super admin belongs to no group, so they choose any group with
// ?group=, starting with the first; `choices` lists the groups to choose from.
export async function resolveLeaderboardGroup({
  userId,
  isSuperAdmin,
  activeGroupId,
  requestedGroupId,
}: {
  userId: string;
  isSuperAdmin: boolean;
  activeGroupId: string | undefined;
  requestedGroupId: string | undefined;
}): Promise<{ group: { id: string; name: string } | null; choices: GroupSummary[] }> {
  if (!isSuperAdmin) {
    const group = resolveActiveGroup(await listUserGroups(userId), activeGroupId);
    return { group: group ?? null, choices: [] };
  }
  const choices = await listGroups();
  const group =
    choices.find((choice) => choice.id === requestedGroupId) ??
    choices.find((choice) => choice.id === activeGroupId) ??
    choices[0] ??
    null;
  return { group, choices };
}

// The leaderboard's URL for a standings page; the super admin's keeps the
// chosen group.
export function leaderboardQuery(page: number, groupId?: string) {
  const params = new URLSearchParams();
  if (groupId) params.set("group", groupId);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Every bracket in the group that has a name or a pick, scored against the
// saved results, highest score first (ties by player name).
export async function loadLeaderboard(
  groupId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<LeaderboardEntry[]> {
  const [latestYear] = await database
    .select({ year: games.year })
    .from(games)
    .orderBy(desc(games.year))
    .limit(1);
  if (!latestYear) return [];

  const [gameRows, teamRows, pickRows, bracketRows] = await Promise.all([
    database.select().from(games).where(eq(games.year, latestYear.year)),
    database.select().from(teams),
    database
      .select({
        userId: picks.userId,
        userName: user.name,
        bracketNumber: picks.bracketNumber,
        gameId: picks.gameId,
        winnerTeamId: picks.winnerTeamId,
      })
      .from(picks)
      .innerJoin(games, eq(picks.gameId, games.id))
      .innerJoin(user, eq(picks.userId, user.id))
      .where(
        and(eq(picks.groupId, groupId), eq(games.year, latestYear.year)),
      ),
    database
      .select({
        userId: brackets.userId,
        userName: user.name,
        number: brackets.number,
        name: brackets.name,
      })
      .from(brackets)
      .innerJoin(user, eq(brackets.userId, user.id))
      .where(eq(brackets.groupId, groupId)),
  ]);

  const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));
  const results = Object.fromEntries(
    gameRows.flatMap((game) => {
      const winner =
        game.actualWinnerTeamId && teamNameById.get(game.actualWinnerTeamId);
      return winner ? [[game.gameId, winner]] : [];
    }),
  );

  const entries = new Map<
    string,
    Omit<LeaderboardEntry, "points" | "maxPoints" | "playedPoints"> & {
      picks: typeof pickRows;
    }
  >();
  const entryFor = (userId: string, userName: string, number: number) => {
    const key = `${userId}:${number}`;
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        userId,
        userName,
        bracketNumber: number,
        bracketName: DEFAULT_BRACKET_NAME,
        picks: [],
      };
      entries.set(key, entry);
    }
    return entry;
  };
  for (const row of bracketRows) {
    entryFor(row.userId, row.userName, row.number).bracketName = row.name;
  }
  for (const row of pickRows) {
    entryFor(row.userId, row.userName, row.bracketNumber).picks.push(row);
  }

  return [...entries.values()]
    .map(({ picks: entryPicks, ...entry }) => {
      const score = scoreBracket(
        applyResults(buildBracket(gameRows, teamRows, entryPicks), results),
      );
      return {
        ...entry,
        points: score.points,
        maxPoints: score.maxPoints,
        playedPoints: score.playedPoints,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.userName.localeCompare(b.userName) ||
        a.bracketNumber - b.bracketNumber,
    );
}
