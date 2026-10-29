import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games, picks, teams } from "@/db/schema";
import { BracketState, FirstFourMatch, Match, Region, Team } from "@/lib/types";

const regionOrder = ["East", "South", "West", "Midwest"];
const roundOrder = ["First Round", "Second Round", "Sweet 16", "Elite 8"];

function toTeam(
  teamId: string | null,
  teamById: Map<string, typeof teams.$inferSelect>,
): Team | null {
  if (!teamId) return null;

  const team = teamById.get(teamId);
  if (!team) throw new Error(`Game references unknown team ${teamId}`);

  return {
    seed: team.seed ?? 0,
    name: team.name,
    logo: team.logo,
    color: team.color.startsWith("#") ? team.color : `#${team.color}`,
  };
}

function toMatch(
  game: typeof games.$inferSelect,
  teamById: Map<string, typeof teams.$inferSelect>,
  winnerByGameId: Map<string, string>,
): Match {
  return {
    id: game.gameId,
    teams:
      game.round === "First Round" || game.round === "First Four"
        ? [toTeam(game.team1Id, teamById), toTeam(game.team2Id, teamById)]
        : [null, null],
    winner: toTeam(winnerByGameId.get(game.id) ?? null, teamById),
    score: [null, null],
    status: "upcoming",
  };
}

function validateWinner(match: Match) {
  if (
    match.winner &&
    !match.teams.some((team) => team?.name === match.winner?.name)
  ) {
    match.winner = null;
  }
}

export function bracketMatches(state: BracketState): Match[] {
  return [
    ...(state.firstFour ?? []),
    ...state.regions.flatMap((region) =>
      region.rounds.flatMap((round) => round.matches),
    ),
    ...state.ff,
    state.championship,
  ];
}

// A user keeps up to three separate brackets in every group they belong to.
// Without bracketNumber this is their first bracket.
export type PickOwner = {
  userId: string;
  groupId: string;
  bracketNumber?: number;
};

export async function loadBracketFromDatabase(
  owner?: PickOwner,
  database: Pick<typeof db, "select"> = db,
): Promise<{
  state: BracketState;
  year: number;
}> {
  const [latestYear] = await database
    .select({ year: games.year })
    .from(games)
    .orderBy(desc(games.year))
    .limit(1);

  if (!latestYear) throw new Error("No tournament games found in the database");

  const [gameRows, teamRows] = await Promise.all([
    database.select().from(games).where(eq(games.year, latestYear.year)),
    database.select().from(teams),
  ]);
  const pickRows = owner
    ? await database
        .select({ gameId: picks.gameId, winnerTeamId: picks.winnerTeamId })
        .from(picks)
        .innerJoin(games, eq(picks.gameId, games.id))
        .where(
          and(
            eq(picks.userId, owner.userId),
            eq(picks.groupId, owner.groupId),
            eq(picks.bracketNumber, owner.bracketNumber ?? 1),
            eq(games.year, latestYear.year),
          ),
        )
    : [];
  return {
    year: latestYear.year,
    state: buildBracket(gameRows, teamRows, pickRows),
  };
}

export function buildBracket(
  gameRows: (typeof games.$inferSelect)[],
  teamRows: (typeof teams.$inferSelect)[],
  pickRows: Pick<typeof picks.$inferSelect, "gameId" | "winnerTeamId">[],
): BracketState {
  const winnerByGameId = new Map(
    pickRows.map((pick) => [pick.gameId, pick.winnerTeamId]),
  );
  const teamById = new Map(teamRows.map((team) => [team.id, team]));
  const sortedGames = [...gameRows].sort((a, b) =>
    a.gameId.localeCompare(b.gameId, undefined, { numeric: true }),
  );
  const firstFour: FirstFourMatch[] = sortedGames
    .filter((game) => game.round === "First Four")
    .map((game) => {
      const match = toMatch(game, teamById, winnerByGameId);
      validateWinner(match);
      const seed = match.teams[0]?.seed;
      if (!seed || !game.region || match.teams[1]?.seed !== seed) {
        throw new Error(`Invalid First Four game ${game.gameId}`);
      }
      const target = sortedGames.find(
        (candidate) =>
          candidate.round === "First Round" &&
          candidate.region === game.region &&
          [candidate.team1Id, candidate.team2Id].some(
            (id) => id && teamById.get(id)?.seed === 17 - seed,
          ),
      );
      if (!target)
        throw new Error(`Missing First Four destination for ${game.gameId}`);
      const nextSlot: 0 | 1 =
        target.team1Id && teamById.get(target.team1Id)?.seed === 17 - seed
          ? 1
          : 0;
      return {
        ...match,
        region: game.region,
        nextGameId: target.gameId,
        nextSlot,
      };
    });
  const regions: Region[] = [
    ...new Set(
      sortedGames
        .map((game) => game.region)
        .filter((region): region is string => Boolean(region)),
    ),
  ]
    .sort((a, b) => {
      const aIndex = regionOrder.indexOf(a);
      const bIndex = regionOrder.indexOf(b);
      return (
        (aIndex === -1 ? regionOrder.length : aIndex) -
          (bIndex === -1 ? regionOrder.length : bIndex) || a.localeCompare(b)
      );
    })
    .map((regionName) => {
      const rounds = roundOrder.map((roundName) => ({
        name: roundName,
        matches: sortedGames
          .filter(
            (game) => game.region === regionName && game.round === roundName,
          )
          .map((game) => {
            const match = toMatch(game, teamById, winnerByGameId);
            for (const feeder of firstFour.filter(
              (feeder) => feeder.nextGameId === game.gameId,
            )) {
              match.teams[feeder.nextSlot] = feeder.winner;
              match.pendingTeams = {
                ...match.pendingTeams,
                [feeder.nextSlot]: feeder.teams.filter(
                  (team): team is Team => team !== null,
                ),
              };
            }
            if (roundName === "First Round") validateWinner(match);
            return match;
          }),
      }));

      for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
        const previous = rounds[roundIndex - 1].matches;
        rounds[roundIndex].matches.forEach((match, matchIndex) => {
          match.teams = [
            previous[matchIndex * 2]?.winner ?? null,
            previous[matchIndex * 2 + 1]?.winner ?? null,
          ];
          validateWinner(match);
        });
      }

      return { name: regionName, rounds };
    });

  const finalFourRows = sortedGames.filter(
    (game) => game.round === "Semifinal",
  );
  const championshipRow = sortedGames.find(
    (game) => game.round === "Championship",
  );
  if (finalFourRows.length !== 2 || !championshipRow) {
    throw new Error("Tournament is missing Final Four or Championship games");
  }

  const ff = finalFourRows.map((game, index) => {
    const match = toMatch(game, teamById, winnerByGameId);
    match.teams = [regions[index * 2], regions[index * 2 + 1]].map(
      (region) => region?.rounds[3].matches[0]?.winner ?? null,
    ) as [Team | null, Team | null];
    validateWinner(match);
    return match;
  });
  const championship = toMatch(championshipRow, teamById, winnerByGameId);
  championship.teams = [ff[0].winner, ff[1].winner];
  validateWinner(championship);

  return {
    regions,
    firstFour,
    ff,
    championship,
  };
}
