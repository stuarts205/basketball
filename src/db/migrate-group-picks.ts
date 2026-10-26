// One-off migration: moves picks from one bracket per user to one bracket per
// user per group. Each user's existing picks go to their default group (first
// by name, matching the app's fallback active group). Safe to rerun: it does
// nothing once picks.group_id exists. Runs in one transaction.
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'picks' AND column_name = 'group_id'`,
    );
    if (rowCount) {
      console.log("picks.group_id already exists; nothing to do.");
      return;
    }

    await client.query("BEGIN");
    await client.query("ALTER TABLE picks ADD COLUMN group_id uuid");
    const assigned = await client.query(`
      UPDATE picks p SET group_id = (
        SELECT gm.group_id FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = p.user_id
        ORDER BY g.name LIMIT 1
      )`);
    const dropped = await client.query("DELETE FROM picks WHERE group_id IS NULL");
    await client.query("ALTER TABLE picks ALTER COLUMN group_id SET NOT NULL");
    await client.query("ALTER TABLE picks DROP CONSTRAINT picks_user_id_game_id_pk");
    await client.query(
      `ALTER TABLE picks ADD CONSTRAINT picks_user_id_group_id_game_id_pk
       PRIMARY KEY (user_id, group_id, game_id)`,
    );
    await client.query(
      `ALTER TABLE picks ADD CONSTRAINT picks_group_id_user_id_group_members_group_id_user_id_fk
       FOREIGN KEY (group_id, user_id) REFERENCES group_members(group_id, user_id)
       ON DELETE CASCADE`,
    );
    await client.query("COMMIT");
    console.log(
      `Migrated: ${assigned.rowCount} picks assigned to groups, ` +
        `${dropped.rowCount} dropped (users in no group).`,
    );
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
