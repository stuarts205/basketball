import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { games, teams } from "../db/schema";
import { Tournament } from "./bracket-source";
import { OPENING_ROUND } from "./types";

export const TOURNAMENT_YEAR = 2027;
const season = "2026-27";
const sourceUrl = `https://www.espn.com/mens-college-basketball/bracket/_/season/${TOURNAMENT_YEAR}`;
const dataDir = path.join(process.cwd(), "data");
const fieldFile = path.join(dataDir, `tournament-${TOURNAMENT_YEAR}.json`);
const regionOrder = ["East", "South", "West", "Midwest"];
// First Round games in bracket order, top seed first.
const firstRoundSeeds = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];
export const TEAM_COUNT = 76;
// 12 Opening Round games, 63 in the 64-team bracket.
export const GAME_COUNT = 75;
const OPENING_ROUND_GAMES = 12;

// The field saved in data/tournament-<year>.json. Each region lists its
// seeds 1 to 16; a seed with two teams is an Opening Round game whose winner
// takes that seed's First Round slot. Teams are named by their location in
// data/teams.json.
export type Field = {
  season: string;
  projected?: boolean;
  sourceUrl: string;
  retrievedAt: string;
  regions: { name: string; seeds: string[][] }[];
};

type GameRow = Omit<typeof games.$inferInsert, "team1Id" | "team2Id"> & {
  // Source team ids (data/teams.json), swapped for database ids on import.
  team1: string | null;
  team2: string | null;
};

export async function loadTournament(): Promise<Field> {
  return JSON.parse(await readFile(fieldFile, "utf8"));
}

// Downloads the current bracket from ESPN without saving it anywhere.
export async function fetchTournament(): Promise<Tournament> {
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
    throw new Error(`ESPN did not return the ${season} tournament`);
  }
  return bracket;
}

// Checks the field is complete and builds the team and game rows.
export async function validateTournament(field: Field) {
  if (field.season !== season)
    throw new Error(`Expected the ${season} tournament`);
  if (field.regions.map((region) => region.name).join() !== regionOrder.join())
    throw new Error(`Regions must be ${regionOrder.join(", ")}`);

  const catalog: {
    sports: {
      leagues: {
        teams: {
          team: {
            id: string;
            slug: string;
            abbreviation: string;
            name: string;
            location: string;
            color?: string;
            alternateColor?: string;
            logos?: { href: string }[];
          };
        }[];
      }[];
    }[];
  } = JSON.parse(await readFile(path.join(dataDir, "teams.json"), "utf8"));
  const byLocation = new Map(
    catalog.sports.flatMap((sport) =>
      sport.leagues.flatMap((league) =>
        league.teams.map(({ team }) => [team.location, team] as const),
      ),
    ),
  );

  const teamRows = new Map<string, typeof teams.$inferInsert>();
  const gameRows: GameRow[] = [];
  const row = (
    gameId: string,
    round: string,
    region: string | null,
    team1: string | null = null,
    team2: string | null = null,
  ) =>
    gameRows.push({ gameId, year: TOURNAMENT_YEAR, region, round, team1, team2 });

  for (const region of field.regions) {
    if (region.seeds.length !== 16)
      throw new Error(`${region.name} must have 16 seeds`);
    // Source team ids by seed; two for an Opening Round seed.
    const seedTeams = region.seeds.map((names, index) => {
      if (names.length < 1 || names.length > 2)
        throw new Error(`${region.name} seed ${index + 1} needs 1 or 2 teams`);
      return names.map((name) => {
        const team = byLocation.get(name);
        if (!team) throw new Error(`Unknown team: ${name}`);
        if (teamRows.has(team.id)) throw new Error(`${name} is in twice`);
        teamRows.set(team.id, {
          teamId: team.id,
          slug: team.slug,
          name: team.location,
          nickname: team.name,
          abbreviation: team.abbreviation,
          color: team.color || "000000",
          alternateColor: team.alternateColor || "ffffff",
          logo: team.logos?.[0]?.href ?? "",
          seed: index + 1,
          region: region.name,
        });
        return team.id;
      });
    });
    const code = region.name.toLowerCase();
    firstRoundSeeds.forEach((pair, slot) => {
      const [top, bottom] = pair.map((seed) => seedTeams[seed - 1]);
      if (top.length === 2 && bottom.length === 2)
        throw new Error(`${region.name} game ${slot + 1} has two Opening Round slots`);
      // An Opening Round slot is empty until a winner is picked.
      row(
        `${code}-r64-${slot + 1}`,
        "First Round",
        region.name,
        top.length === 1 ? top[0] : null,
        bottom.length === 1 ? bottom[0] : null,
      );
    });
    for (const [round, count] of [
      ["Second Round", 4],
      ["Sweet 16", 2],
      ["Elite 8", 1],
    ] as const) {
      const roundCode = { "Second Round": "r32", "Sweet 16": "s16", "Elite 8": "e8" }[round];
      for (let slot = 0; slot < count; slot++)
        row(`${code}-${roundCode}-${slot}`, round, region.name);
    }
  }
  // Opening Round games last so they're numbered by region, then seed.
  const openingRound = field.regions.flatMap((region) =>
    region.seeds
      .filter((names) => names.length === 2)
      .map((names) => ({
        region: region.name,
        teams: names.map((name) => byLocation.get(name)!.id),
      })),
  );
  openingRound.forEach((game, index) =>
    row(
      `opening-round-${index + 1}`,
      OPENING_ROUND,
      game.region,
      game.teams[0],
      game.teams[1],
    ),
  );
  row("ff-1", "Semifinal", null);
  row("ff-2", "Semifinal", null);
  row("championship", "Championship", null);

  if (openingRound.length !== OPENING_ROUND_GAMES)
    throw new Error(
      `Expected ${OPENING_ROUND_GAMES} Opening Round games, found ${openingRound.length}`,
    );
  if (teamRows.size !== TEAM_COUNT)
    throw new Error(`Expected ${TEAM_COUNT} teams, found ${teamRows.size}`);
  if (gameRows.length !== GAME_COUNT)
    throw new Error(`Expected ${GAME_COUNT} games, built ${gameRows.length}`);
  return { teamRows, gameRows };
}

// Writes the tournament's teams and games in one transaction. User picks are
// kept; `replace` clears existing games and teams first.
export async function importTournament(
  database: NodePgDatabase,
  { teamRows, gameRows }: Awaited<ReturnType<typeof validateTournament>>,
  { replace = false } = {},
) {
  await database.transaction(async (transaction) => {
    if (replace) {
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
    for (const { team1, team2, ...game } of gameRows) {
      const values = {
        ...game,
        team1Id: team1 && idByTeamId.get(team1)!,
        team2Id: team2 && idByTeamId.get(team2)!,
        actualWinnerTeamId: null,
        actualScore1: null,
        actualScore2: null,
      };
      await transaction
        .insert(games)
        .values(values)
        .onConflictDoUpdate({ target: games.gameId, set: values });
    }
    const storedGames = await transaction
      .select()
      .from(games)
      .where(eq(games.year, TOURNAMENT_YEAR));
    const openSlots = storedGames
      .filter((game) => game.round === "First Round")
      .flatMap((game) => [game.team1Id, game.team2Id])
      .filter((id) => !id).length;
    if (
      storedGames.length !== GAME_COUNT ||
      openSlots !== OPENING_ROUND_GAMES ||
      storedGames.some(
        (game) =>
          game.round === OPENING_ROUND && (!game.team1Id || !game.team2Id),
      )
    ) {
      throw new Error("Database verification failed; rolling back import");
    }
  });
}
