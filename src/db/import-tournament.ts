import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  GAME_COUNT,
  TEAM_COUNT,
  TOURNAMENT_YEAR,
  importTournament,
  loadTournament,
  validateTournament,
} from "../lib/import-tournament";

async function main() {
  const field = await loadTournament();
  const tournament = await validateTournament(field);
  console.log(
    `Validated ${tournament.teamRows.size} teams and ${tournament.gameRows.length} games for ${TOURNAMENT_YEAR}, including the Opening Round${field.projected ? " (projected field)" : ""}`,
  );
  if (process.argv.includes("--dry-run")) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await importTournament(drizzle(pool), tournament, {
      replace: process.argv.includes("--replace"),
    });
    console.log(
      `Database verified: ${TEAM_COUNT} teams and ${GAME_COUNT} games; user picks preserved separately`,
    );
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
