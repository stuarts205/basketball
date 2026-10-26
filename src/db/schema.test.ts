import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";

test("all foreign keys use the same SQL type as their referenced columns", () => {
  for (const table of Object.values(schema)) {
    const { name, foreignKeys } = getTableConfig(table);
    for (const foreignKey of foreignKeys) {
      const { columns, foreignColumns } = foreignKey.reference();
      columns.forEach((column, index) => {
        assert.equal(
          column.getSQLType(),
          foreignColumns[index].getSQLType(),
          `${name}.${column.name} must match its referenced column type`,
        );
      });
    }
  }
});

test("auth user IDs and references use text with cascading deletes", () => {
  assert.equal(schema.user.id.getSQLType(), "text");
  for (const table of [schema.session, schema.account, schema.picks]) {
    assert.equal(table.userId.getSQLType(), "text");
    const foreignKey = getTableConfig(table).foreignKeys.find((key) =>
      key.reference().columns.includes(table.userId),
    );
    assert.ok(foreignKey);
    assert.equal(foreignKey.reference().foreignColumns[0], schema.user.id);
    assert.equal(foreignKey.onDelete, "cascade");
  }
});

test("picks are unique per user and game and deleted with their game", () => {
  const config = getTableConfig(schema.picks);
  assert.deepEqual(
    config.primaryKeys[0].columns.map((column) => column.name),
    [schema.picks.userId.name, schema.picks.gameId.name],
  );
  const gameKey = config.foreignKeys.find((key) =>
    key.reference().columns.includes(schema.picks.gameId),
  );
  assert.ok(gameKey);
  assert.equal(gameKey.reference().foreignColumns[0], schema.games.id);
  assert.equal(gameKey.onDelete, "cascade");
  assert.equal("winnerTeamId" in schema.games, false);
});
