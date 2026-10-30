// One-off migration: lets each member keep up to three brackets per group.
// Adds the brackets table (bracket names) and picks.bracket_number, and puts
// every existing pick in bracket 1. Any name saved in group_members.bracket_name
// becomes bracket 1's name, then that column is dropped.
//
// Each step checks what is already there, so it also repairs a database that
// a failed `drizzle-kit push` left half changed, and is safe to rerun. Runs in
// one transaction; pass --dry-run to roll it back instead of committing.
import "dotenv/config";
import type { PoolClient } from "pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const dryRun = process.argv.includes("--dry-run");

async function exists(client: PoolClient, sql: string, params: unknown[]) {
  return Boolean((await client.query(sql, params)).rowCount);
}

const columnExists = (client: PoolClient, table: string, column: string) =>
  exists(
    client,
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );

// Adds the constraint unless one with that name is already on the table.
async function ensureConstraint(
  client: PoolClient,
  table: string,
  name: string,
  definition: string,
  log: string[],
) {
  const found = await exists(
    client,
    `SELECT 1 FROM pg_constraint
     WHERE conrelid = $1::regclass AND conname = $2`,
    [`public.${table}`, name],
  );
  if (found) return;
  await client.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition}`);
  log.push(`added ${table}.${name}`);
}

async function main() {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "brackets" (
        "group_id" uuid NOT NULL,
        "user_id" text NOT NULL,
        "number" integer NOT NULL,
        "name" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`);
    await ensureConstraint(client, "brackets", "brackets_group_id_user_id_number_pk",
      `PRIMARY KEY ("group_id","user_id","number")`, log);
    await ensureConstraint(client, "brackets", "brackets_number_range",
      `CHECK ("number" between 1 and 3)`, log);
    await ensureConstraint(client, "brackets", "brackets_user_id_user_id_fk",
      `FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade`, log);
    await ensureConstraint(client, "brackets",
      "brackets_group_id_user_id_group_members_group_id_user_id_fk",
      `FOREIGN KEY ("group_id","user_id")
       REFERENCES "public"."group_members"("group_id","user_id") ON DELETE cascade`, log);

    if (await columnExists(client, "group_members", "bracket_name")) {
      const result = await client.query(`
        INSERT INTO brackets (group_id, user_id, number, name)
        SELECT group_id, user_id, 1, trim(bracket_name) FROM group_members
        WHERE trim(coalesce(bracket_name, '')) <> ''
        ON CONFLICT DO NOTHING`);
      await client.query("ALTER TABLE group_members DROP COLUMN bracket_name");
      log.push(
        `moved ${result.rowCount ?? 0} bracket names and dropped group_members.bracket_name`,
      );
    }

    // Existing picks get the default, bracket 1.
    if (!(await columnExists(client, "picks", "bracket_number"))) {
      await client.query(
        `ALTER TABLE picks ADD COLUMN bracket_number integer DEFAULT 1 NOT NULL`,
      );
      log.push("added picks.bracket_number (existing picks are bracket 1)");
    }
    await ensureConstraint(client, "picks", "picks_bracket_number_range",
      `CHECK ("bracket_number" between 1 and 3)`, log);
    await client.query(
      "ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_user_id_group_id_game_id_pk",
    );
    await ensureConstraint(client, "picks",
      "picks_user_id_group_id_bracket_number_game_id_pk",
      `PRIMARY KEY ("user_id","group_id","bracket_number","game_id")`, log);
    await ensureConstraint(client, "picks",
      "picks_group_id_user_id_group_members_group_id_user_id_fk",
      `FOREIGN KEY ("group_id","user_id")
       REFERENCES "public"."group_members"("group_id","user_id") ON DELETE cascade`, log);

    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
    console.log(log.length ? log.map((line) => `- ${line}`).join("\n") : "Nothing to do.");
    if (dryRun && log.length) console.log("Dry run: rolled back, nothing was changed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed and was rolled back:", error);
  process.exit(1);
});
