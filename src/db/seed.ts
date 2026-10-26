import "dotenv/config";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import { Pool } from "pg";
import bracket from "../../data/data.json";
import { getTeamLogoUrl } from "../lib/team-logos";
import { games, teams } from "./schema";

type CatalogTeam = {
  id: string;
  slug: string;
  abbreviation: string;
  name: string;
  color: string;
  alternateColor: string;
};

const catalog: {
  sports: { leagues: { teams: { team: CatalogTeam }[] }[] }[];
} = JSON.parse(
  readFileSync(new URL("../../data/teams.json", import.meta.url), "utf8"),
);
const catalogById = new Map(
  catalog.sports.flatMap((sport) =>
    sport.leagues.flatMap((league) =>
      league.teams.map(({ team }) => [team.id, team] as const),
    ),
  ),
);
const teamRows: (typeof teams.$inferInsert)[] = [];
const teamIdByName = new Map<string, string>();
const bracketAliases: Record<string, string> = {
  "Vermont State": "vermont-state",
  "Liberty Tech": "liberty-tech",
};

for (const region of bracket.regions) {
  for (const match of region.rounds[0].matches) {
    for (const team of match.teams) {
      const logo = getTeamLogoUrl(team.name);
      const teamId = logo?.split("/").pop()?.replace(".png", "");
      const metadata = teamId ? catalogById.get(teamId) : undefined;
      const seed = Number(team.seed);
      if (
        !metadata ||
        !logo ||
        !Number.isInteger(seed) ||
        seed < 1 ||
        seed > 16
      ) {
        throw new Error(`Invalid tournament team: ${team.name}`);
      }
      const alias = bracketAliases[team.name];
      const sourceTeamId = alias ? `bracket:${alias}` : metadata.id;
      if (teamRows.some((row) => row.teamId === sourceTeamId)) {
        throw new Error(`Duplicate tournament team: ${team.name}`);
      }
      teamIdByName.set(team.name, sourceTeamId);
      teamRows.push({
        teamId: sourceTeamId,
        slug: alias ?? metadata.slug,
        abbreviation: metadata.abbreviation,
        name: team.name,
        nickname: metadata.name,
        color: metadata.color,
        alternateColor: metadata.alternateColor,
        logo,
        seed,
        region: region.name,
      });
    }
  }
}

const sourceGames = [
  ...bracket.regions.flatMap((region) =>
    region.rounds.flatMap((round) =>
      round.matches.map((match) => ({
        ...match,
        region: region.name,
        round: round.name,
      })),
    ),
  ),
  ...bracket.finalFour.map((match) => ({
    ...match,
    region: null,
    round: "Semifinal",
  })),
  { ...bracket.championship, region: null, round: "Championship" },
];
if (
  teamRows.length !== 64 ||
  sourceGames.length !== 63 ||
  new Set(sourceGames.map((game) => game.id)).size !== 63
) {
  throw new Error("Expected 64 unique teams and 63 unique tournament games");
}
for (const game of sourceGames) {
  for (const team of game.teams) {
    if (!teamIdByName.has(team.name))
      throw new Error(`Unknown team: ${team.name}`);
  }
}

async function seed() {
  if (process.argv.includes("--dry-run")) {
    console.log(
      `Validated ${teamRows.length} teams and ${sourceGames.length} games for ${bracket.year}`,
    );
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    await db.transaction(async (transaction) => {
      const idByTeamId = new Map<string, string>();
      for (const team of teamRows) {
        const [saved] = await transaction
          .insert(teams)
          .values(team)
          .onConflictDoUpdate({ target: teams.teamId, set: team })
          .returning({ id: teams.id });
        idByTeamId.set(team.teamId, saved.id);
      }
      const resolveTeam = (name: string | undefined) => {
        if (!name) return null;
        const teamId = teamIdByName.get(name);
        const id = teamId ? idByTeamId.get(teamId) : undefined;
        if (!id) throw new Error(`Unresolved team: ${name}`);
        return id;
      };
      await transaction
        .insert(games)
        .values(
          sourceGames.map((game) => ({
            gameId: game.id,
            year: bracket.year,
            region: game.region,
            round: game.round,
            team1Id: resolveTeam(game.teams[0]?.name),
            team2Id: resolveTeam(game.teams[1]?.name),
          })),
        )
        .onConflictDoNothing({ target: games.gameId });
      const savedGames = await transaction
        .select()
        .from(games)
        .where(
          inArray(
            games.gameId,
            sourceGames.map((game) => game.id),
          ),
        );
      if (
        savedGames.length !== sourceGames.length ||
        savedGames.some((game) => game.year !== bracket.year)
      ) {
        throw new Error("Stored games do not match the tournament year");
      }
      for (const source of sourceGames) {
        const saved = savedGames.find((game) => game.gameId === source.id)!;
        if (
          saved.round !== source.round ||
          saved.region !== source.region ||
          (source.teams.length === 2 &&
            (saved.team1Id !== resolveTeam(source.teams[0].name) ||
              saved.team2Id !== resolveTeam(source.teams[1].name)))
        ) {
          throw new Error(`Stored game does not match source: ${source.id}`);
        }
      }
    });
    console.log(
      `Loaded and verified ${teamRows.length} teams and ${sourceGames.length} games for ${bracket.year}`,
    );
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Database import failed",
  );
  process.exitCode = 1;
});
