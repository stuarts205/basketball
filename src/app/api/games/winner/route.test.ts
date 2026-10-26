import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games, teams } from "@/db/schema";
import { loadBracketFromDatabase } from "@/lib/load-bracket";
import type { BracketState, Match } from "@/lib/types";
import { PUT } from "./route";

test("changing completed bracket picks preserves valid picks and stays in sync", async (t) => {
  const rollback = new Error("Roll back regression test picks");
  const originalTransaction = db.transaction.bind(db);
  const before = await db.select().from(games);

  try {
    await assert.rejects(
      originalTransaction(async (tx) => {
        // Exercise real queries and handlers without persisting test picks.
        const transactionMock = t.mock.method(
          db,
          "transaction",
          async (callback: (transaction: typeof tx) => Promise<unknown>) =>
            callback(tx),
        );
        const selectMock = t.mock.method(db, "select", tx.select.bind(tx));
        try {
          await tx.select().from(games).for("update");
          await tx.update(games).set({ winnerTeamId: null });
          const teamRows = await tx.select().from(teams);
          const idByName = new Map(
            teamRows.map((team) => [team.name, team.id]),
          );

          async function pick(gameId: string, teamName: string) {
            const response = await PUT(
              new Request("http://localhost/api/games/winner", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId, teamName }),
              }),
            );
            const body = await response.json();
            assert.equal(response.status, 200, JSON.stringify(body));
            assert.ok(body.saved);
            const state: BracketState = body.state;
            assert.ok(state);
            assert.deepEqual(state, (await loadBracketFromDatabase()).state);
            return state;
          }

          async function seedWinners(matches: Match[]) {
            for (const match of matches) {
              const winner = match.teams[0];
              assert.ok(winner, `Missing participant for ${match.id}`);
              const winnerTeamId = idByName.get(winner.name);
              assert.ok(winnerTeamId);
              await tx
                .update(games)
                .set({ winnerTeamId })
                .where(eq(games.gameId, match.id));
            }
          }

          let state = (await loadBracketFromDatabase()).state;
          for (const match of state.firstFour ?? []) {
            assert.ok(match.teams[0]);
            state = await pick(match.id, match.teams[0].name);
          }
          for (let round = 0; round < 4; round++) {
            await seedWinners(
              state.regions.flatMap((region) => region.rounds[round].matches),
            );
            state = (await loadBracketFromDatabase()).state;
          }
          await seedWinners(state.ff);
          state = (await loadBracketFromDatabase()).state;
          await seedWinners([state.championship]);
          state = (await loadBracketFromDatabase()).state;
          assert.equal(state.championship.winner?.name, "Duke");

          // Leave Louisville available as a new Sweet 16 pick.
          const east = state.regions.find((region) => region.name === "East");
          assert.ok(east);
          const louisvilleGame = east.rounds[2].matches[1];
          assert.equal(louisvilleGame.teams[0]?.name, "Louisville");
          const opponent = louisvilleGame.teams[1];
          assert.ok(opponent);
          state = await pick(louisvilleGame.id, opponent.name);
          assert.equal(state.championship.winner?.name, "Duke");

          const beforeChange = structuredClone(state);
          state = await pick(east.rounds[0].matches[0].id, "Siena");
          const updatedEast = state.regions.find((region) => region.name === "East");
          assert.ok(updatedEast);
          assert.equal(updatedEast.rounds[0].matches[0].winner?.name, "Siena");
          assert.equal(updatedEast.rounds[1].matches[0].teams[0]?.name, "Siena");
          for (let round = 1; round < 4; round++) {
            assert.equal(updatedEast.rounds[round].matches[0].winner, null);
          }
          assert.equal(state.ff[0].winner, null);
          assert.equal(state.championship.winner, null);
          assert.deepEqual(
            updatedEast.rounds[1].matches.slice(1),
            beforeChange.regions[0].rounds[1].matches.slice(1),
          );
          assert.deepEqual(
            updatedEast.rounds[2].matches[1],
            beforeChange.regions[0].rounds[2].matches[1],
          );
          assert.deepEqual(state.regions.slice(1), beforeChange.regions.slice(1));
          assert.deepEqual(state.ff[1], beforeChange.ff[1]);

          state = await pick(louisvilleGame.id, "Louisville");
          assert.equal(
            state.regions[0].rounds[2].matches[1].winner?.name,
            "Louisville",
          );
          assert.equal(
            state.regions[0].rounds[3].matches[0].teams[1]?.name,
            "Louisville",
          );

          // Rebuild the changed path through a new champion.
          state = await pick(updatedEast.rounds[1].matches[0].id, "Siena");
          state = await pick(updatedEast.rounds[2].matches[0].id, "Siena");
          state = await pick(updatedEast.rounds[3].matches[0].id, "Louisville");
          state = await pick(state.ff[0].id, "Louisville");
          state = await pick(state.championship.id, "Louisville");
          assert.equal(state.championship.winner?.name, "Louisville");

          const unchanged = structuredClone(state);
          state = await pick(louisvilleGame.id, "Louisville");
          assert.deepEqual(state, unchanged);

          const semifinalOpponent = state.ff[0].teams[1];
          assert.ok(semifinalOpponent);
          state = await pick(state.ff[0].id, semifinalOpponent.name);
          assert.equal(state.championship.winner, null);
          assert.equal(
            state.championship.teams[0]?.name,
            semifinalOpponent.name,
          );

          const preliminary = state.firstFour?.[0];
          assert.ok(preliminary?.teams[1]);
          state = await pick(preliminary.id, preliminary.teams[1].name);
          const firstRound = state.regions
            .flatMap((region) => region.rounds[0].matches)
            .find((match) => match.id === preliminary.nextGameId);
          assert.equal(
            firstRound?.teams[preliminary.nextSlot]?.name,
            preliminary.teams[1].name,
          );
        } finally {
          transactionMock.mock.restore();
          selectMock.mock.restore();
        }
        throw rollback;
      }),
      (error) => error === rollback,
    );
    assert.deepEqual(await db.select().from(games), before);
  } finally {
    await db.$client.end();
  }
});
