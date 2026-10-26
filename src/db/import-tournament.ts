import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { games, teams } from "./schema";

type Competitor = {
  id: string;
  name: string;
  location: string;
  abbreviation: string;
  color: string;
  alternateColor: string;
  logo: string;
  seed: string;
  winner: boolean;
};
type Matchup = {
  id: string;
  roundId: number;
  bracketLocation: number;
  regionId?: number;
  statusState: string;
  competitorOne: Competitor;
  competitorTwo: Competitor;
};
type Tournament = {
  season: number | string;
  matchups: Matchup[];
  regions: { id: number; slug: string }[];
};

const year = 2026;
const sourceUrl = `https://www.espn.com/mens-college-basketball/bracket/_/season/${year}`;
const snapshot = new URL(`../../data/tournament-${year}.json`, import.meta.url);
const regionOrder = ["East", "South", "West", "Midwest"];
const season = "2025-26";
const roundNames = [
  "First Four",
  "First Round",
  "Second Round",
  "Sweet 16",
  "Elite 8",
  "Semifinal",
  "Championship",
];
const roundCodes = ["first-four", "r64", "r32", "s16", "e8"];

async function loadTournament(): Promise<Tournament> {
  if (!process.argv.includes("--refresh")) {
    try {
      return JSON.parse(await readFile(snapshot, "utf8")).bracket;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`ESPN returned HTTP ${response.status}`);
  const html = await response.text();
  const marker = "window['__espnfitt__']=";
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((text) => text.includes(marker));
  if (!script) throw new Error("ESPN bracket data was not found");
  const state = JSON.parse(
    script
      .slice(script.indexOf(marker) + marker.length)
      .trim()
      .replace(/;$/, ""),
  );
  const bracket: Tournament = state.page.content.bracket;
  if (!bracket?.matchups?.length || bracket.season !== season) {
    throw new Error("ESPN did not return the 2025-26 tournament");
  }
  await writeFile(
    snapshot,
    JSON.stringify(
      { sourceUrl, retrievedAt: new Date().toISOString(), bracket },
      null,
      2,
    ) + "\n",
  );
  return bracket;
}

async function main() {
  const bracket = await loadTournament();
  const sourceGames = bracket.matchups;
  if (
    bracket.season !== season ||
    sourceGames.length !== 67 ||
    new Set(sourceGames.map((game) => game.id)).size !== 67
  ) {
    throw new Error("Expected 67 unique games for the 2026 tournament");
  }
  const counts = [4, 32, 16, 8, 4, 2, 1];
  for (const [round, count] of counts.entries()) {
    const matches = sourceGames.filter((game) => game.roundId === round);
    if (
      matches.length !== count ||
      new Set(matches.map((game) => game.bracketLocation)).size !== count ||
      matches.some(
        (game) => game.bracketLocation < 1 || game.bracketLocation > count,
      )
    ) {
      throw new Error(`Invalid slots for ${roundNames[round]}`);
    }
  }
  const regionFor = (game: Matchup) => {
    if (game.roundId >= 5) return null;
    if (game.roundId === 0) {
      const slug = bracket.regions.find(
        (region) => region.id === game.regionId,
      )?.slug;
      const region = regionOrder.find((name) => name.toLowerCase() === slug);
      if (!region)
        throw new Error(`Unknown First Four region: ${game.regionId}`);
      return region;
    }
    return regionOrder[
      Math.floor((game.bracketLocation - 1) / (8 / 2 ** (game.roundId - 1)))
    ];
  };
  const teamRows = new Map<string, typeof teams.$inferInsert>();
  const catalog: {
    sports: {
      leagues: {
        teams: { team: { id: string; slug: string; name: string } }[];
      }[];
    }[];
  } = JSON.parse(
    await readFile(new URL("../../data/teams.json", import.meta.url), "utf8"),
  );
  const metadata = new Map(
    catalog.sports.flatMap((sport) =>
      sport.leagues.flatMap((league) =>
        league.teams.map(({ team }) => [team.id, team] as const),
      ),
    ),
  );
  for (const game of sourceGames) {
    const competitors = [game.competitorOne, game.competitorTwo];
    if (
      game.statusState !== "post" ||
      competitors.filter((team) => team?.winner).length !== 1 ||
      competitors.some(
        (team) =>
          !team?.id ||
          !team.name ||
          !Number.isInteger(Number(team.seed)) ||
          Number(team.seed) < 1 ||
          Number(team.seed) > 16,
      ) ||
      competitors[0].id === competitors[1].id
    ) {
      throw new Error(`Incomplete or invalid game ${game.id}`);
    }
    if (game.roundId > 1) {
      const feeders = sourceGames.filter(
        (previous) =>
          previous.roundId === game.roundId - 1 &&
          [game.bracketLocation * 2 - 1, game.bracketLocation * 2].includes(
            previous.bracketLocation,
          ),
      );
      const winners = feeders.map(
        (feeder) =>
          [feeder.competitorOne, feeder.competitorTwo].find(
            (team) => team.winner,
          )!.id,
      );
      if (
        winners.length !== 2 ||
        competitors.some((team) => !winners.includes(team.id))
      ) {
        throw new Error(`Feeder winners do not match game ${game.id}`);
      }
    }
    const region = regionFor(game);
    for (const team of competitors) {
      if (!region) {
        if (!teamRows.has(team.id))
          throw new Error(`Unknown finalist ${team.id}`);
        continue;
      }
      const existing = teamRows.get(team.id);
      if (
        existing &&
        (existing.region !== region || existing.seed !== Number(team.seed))
      ) {
        throw new Error(`Inconsistent team placement: ${team.name}`);
      }
      const details = metadata.get(team.id);
      teamRows.set(team.id, {
        teamId: team.id,
        slug:
          details?.slug ??
          `${team.location.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${team.id}`,
        name: team.location,
        nickname: details?.name ?? team.name,
        abbreviation: team.abbreviation,
        color: team.color || "000000",
        alternateColor: team.alternateColor || "ffffff",
        logo: team.logo,
        seed: Number(team.seed),
        region,
      });
    }
  }
  if (teamRows.size !== 68)
    throw new Error(`Expected 68 teams, received ${teamRows.size}`);
  const firstRoundIds = new Set(
    sourceGames
      .filter((game) => game.roundId === 1)
      .flatMap((game) => [game.competitorOne.id, game.competitorTwo.id]),
  );
  for (const game of sourceGames.filter((game) => game.roundId === 0)) {
    const winner = [game.competitorOne, game.competitorTwo].find(
      (team) => team.winner,
    )!;
    const loser = [game.competitorOne, game.competitorTwo].find(
      (team) => !team.winner,
    )!;
    if (!firstRoundIds.has(winner.id) || firstRoundIds.has(loser.id)) {
      throw new Error(`First Four advancement mismatch: ${game.id}`);
    }
  }
  console.log(
    `Validated ${teamRows.size} teams and ${sourceGames.length} completed games for ${year}, including the First Four`,
  );
  if (process.argv.includes("--dry-run")) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool);
    await db.transaction(async (transaction) => {
      if (process.argv.includes("--replace")) {
        await transaction.delete(games);
        await transaction.delete(teams);
      }
      const idByTeamId = new Map<string, string>();
      for (const team of teamRows.values()) {
        const [saved] = await transaction
          .insert(teams)
          .values(team)
          .onConflictDoUpdate({ target: teams.teamId, set: team })
          .returning({ id: teams.id });
        idByTeamId.set(team.teamId, saved.id);
      }
      const existingGames = await transaction.select().from(games);
      const existingByGameId = new Map(
        existingGames.map((game) => [game.gameId, game]),
      );
      for (const game of sourceGames) {
        const region = regionFor(game);
        const slotsPerRegion = 8 / 2 ** (game.roundId - 1);
        const localSlot = (game.bracketLocation - 1) % slotsPerRegion;
        const gameId =
          game.roundId === 0
            ? `first-four-${game.bracketLocation}`
            : game.roundId === 5
              ? `ff-${game.bracketLocation}`
              : game.roundId === 6
                ? "championship"
                : `${region!.toLowerCase()}-${roundCodes[game.roundId]}-${game.roundId === 1 ? localSlot + 1 : localSlot}`;
        const isFirstFourSlot = (competitor: Competitor) =>
          game.roundId === 1 &&
          sourceGames.some(
            (feeder) =>
              feeder.roundId === 0 &&
              regionFor(feeder) === region &&
              feeder.competitorOne.seed === competitor.seed,
          );
        const pendingFirstFour =
          isFirstFourSlot(game.competitorOne) ||
          isFirstFourSlot(game.competitorTwo);
        const participantId = (competitor: Competitor) => {
          if (game.roundId > 1) return null;
          if (!isFirstFourSlot(competitor))
            return idByTeamId.get(competitor.id)!;
          const feeder = sourceGames.find(
            (candidate) =>
              candidate.roundId === 0 &&
              regionFor(candidate) === region &&
              candidate.competitorOne.seed === competitor.seed,
          )!;
          return (
            existingByGameId.get(`first-four-${feeder.bracketLocation}`)
              ?.winnerTeamId ?? null
          );
        };
        const row = {
          gameId,
          year,
          region,
          round: roundNames[game.roundId],
          team1Id: participantId(game.competitorOne),
          team2Id: participantId(game.competitorTwo),
          ...(game.roundId === 0 || pendingFirstFour
            ? {
                actualWinnerTeamId: null,
              }
            : {}),
        };
        await transaction
          .insert(games)
          .values(row)
          .onConflictDoUpdate({ target: games.gameId, set: row });
      }
      const storedTeams = await transaction.select().from(teams);
      const storedGames = await transaction.select().from(games);
      if (
        storedTeams.length !== 68 ||
        storedGames.length !== 67 ||
        storedGames.some(
          (game) =>
            game.year !== year ||
            (game.round === "First Four" &&
              (!game.team1Id ||
                !game.team2Id ||
                (game.winnerTeamId &&
                  ![game.team1Id, game.team2Id].includes(game.winnerTeamId)) ||
                game.actualWinnerTeamId)) ||
            (game.round === "First Round" && !game.team1Id && !game.team2Id) ||
            (game.round === "First Round" &&
              (!game.team1Id || !game.team2Id) &&
              (game.winnerTeamId || game.actualWinnerTeamId)),
        ) ||
        storedGames
          .filter((game) => game.round === "First Round")
          .flatMap((game) => [game.team1Id, game.team2Id])
          .filter((id) => !id).length !==
          storedGames.filter(
            (game) => game.round === "First Four" && !game.winnerTeamId,
          ).length
      ) {
        throw new Error("Database verification failed; rolling back import");
      }
      console.log(
        "Database verified: 68 teams and 67 games; saved First Four picks and entrants preserved",
      );
    });
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Tournament import failed",
  );
  process.exitCode = 1;
});
