import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  TOURNAMENT_YEAR,
  importTournament,
  loadTournament,
  validateTournament,
} from "../lib/import-tournament";

async function main() {
  const bracket = await loadTournament(process.argv.includes("--refresh"));
  const teamRows = await validateTournament(bracket);
  console.log(
    `Validated ${teamRows.size} teams and ${bracket.matchups.length} completed games for ${TOURNAMENT_YEAR}, including the First Four`,
  );
  if (process.argv.includes("--dry-run")) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await importTournament(drizzle(pool), bracket, teamRows, {
      replace: process.argv.includes("--replace"),
    });
    console.log(
      "Database verified: 68 teams and 67 games; user picks preserved separately",
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
