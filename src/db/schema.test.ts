import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";

test("all foreign keys use the same SQL type as their referenced columns", () => {
  // Keys declared in a table callback hold ExtraConfigColumn stand-ins whose
  // getSQLType() recurses, so resolve each column on its table by name.
  const sqlType = (table: Parameters<typeof getTableConfig>[0], name: string) => {
    const column = getTableConfig(table).columns.find((entry) => entry.name === name);
    assert.ok(column, `${getTableConfig(table).name}.${name} must exist`);
    return column.getSQLType();
  };
  for (const table of Object.values(schema)) {
    const { name, foreignKeys } = getTableConfig(table);
    for (const foreignKey of foreignKeys) {
      const { columns, foreignColumns, foreignTable } = foreignKey.reference();
      columns.forEach((column, index) => {
        assert.equal(
          sqlType(table, column.name),
          sqlType(foreignTable, foreignColumns[index].name),
          `${name}.${column.name} must match its referenced column type`,
        );
      });
    }
  }
});

test("auth user IDs and references use text with cascading deletes", () => {
  assert.equal(schema.user.id.getSQLType(), "text");
  for (const table of [
    schema.session,
    schema.account,
    schema.picks,
    schema.groupMembers,
  ]) {
    assert.equal(table.userId.getSQLType(), "text");
    const foreignKey = getTableConfig(table).foreignKeys.find((key) =>
      key.reference().columns.includes(table.userId),
    );
    assert.ok(foreignKey);
    assert.equal(foreignKey.reference().foreignColumns[0], schema.user.id);
    assert.equal(foreignKey.onDelete, "cascade");
  }
});

test("picks are unique per user, group and game and deleted with their membership", () => {
  const config = getTableConfig(schema.picks);
  assert.deepEqual(
    config.primaryKeys[0].columns.map((column) => column.name),
    [schema.picks.userId.name, schema.picks.groupId.name, schema.picks.gameId.name],
  );
  // Keys declared in the table callback hold their own column instances, so
  // compare by name.
  const membershipKey = config.foreignKeys.find((key) =>
    key.reference().columns.some((column) => column.name === schema.picks.groupId.name),
  );
  assert.ok(membershipKey);
  assert.deepEqual(
    membershipKey.reference().columns.map((column) => column.name),
    [schema.picks.groupId.name, schema.picks.userId.name],
  );
  assert.deepEqual(
    membershipKey.reference().foreignColumns.map((column) => column.name),
    [schema.groupMembers.groupId.name, schema.groupMembers.userId.name],
  );
  assert.equal(
    getTableConfig(membershipKey.reference().foreignTable).name,
    "group_members",
  );
  assert.equal(membershipKey.onDelete, "cascade");
  const gameKey = config.foreignKeys.find((key) =>
    key.reference().columns.includes(schema.picks.gameId),
  );
  assert.ok(gameKey);
  assert.equal(gameKey.reference().foreignColumns[0], schema.games.id);
  assert.equal(gameKey.onDelete, "cascade");
  assert.equal("winnerTeamId" in schema.games, false);
});
