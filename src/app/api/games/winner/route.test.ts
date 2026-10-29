import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { games, groupMembers, groups, picks, teams, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  copyPicksIntoEmptyGroup, joinGroup, listBracketChoices, pickSourcesFor,
} from "@/lib/groups";
import {
  DEFAULT_BRACKET_NAME, createBracket, hasNamedBracket, listBrackets,
} from "@/lib/brackets";
import { bracketMatches, loadBracketFromDatabase } from "@/lib/load-bracket";
import type { BracketState, Match } from "@/lib/types";
import { DELETE, PUT } from "./route";

test("user picks stay isolated through completed-bracket edits and resets", async (t) => {
  const rollback = new Error("Roll back regression test picks");
  const originalTransaction = db.transaction.bind(db);

  try {
    const before = await db.select().from(games).orderBy(games.id);
    const teamRows = await db.select().from(teams);
    assert.equal(before.length, 67, "Import the 2026 tournament before testing");
    const statements = await generateMigration(
      generateDrizzleJson({}), generateDrizzleJson(schema),
    );
    await assert.rejects(
      originalTransaction(async (tx) => {
        const testSchema = `picks_test_${randomUUID().replaceAll("-", "")}`;
        await tx.execute(sql`CREATE SCHEMA ${sql.identifier(testSchema)}`);
        await tx.execute(sql`SET LOCAL search_path TO ${sql.identifier(testSchema)}`);
        for (const statement of statements) {
          await tx.execute(sql.raw(statement.replaceAll('"public".', `"${testSchema}".`)));
        }
        await tx.insert(teams).values(teamRows);
        await tx.insert(games).values(before);
        await tx.insert(user).values([
          { id: "user-a", name: "User A", email: "a@example.test" },
          { id: "user-b", name: "User B", email: "b@example.test" },
        ]);
        // user-a keeps a separate bracket in each of their groups.
        const mainGroup = randomUUID();
        const otherGroup = randomUUID();
        const outsiderGroup = randomUUID();
        await tx.insert(groups).values([
          { id: mainGroup, name: "Main" },
          { id: otherGroup, name: "Other" },
          { id: outsiderGroup, name: "Outsider" },
        ]);
        await tx.insert(groupMembers).values([
          { groupId: mainGroup, userId: "user-a" },
          { groupId: mainGroup, userId: "user-b" },
          { groupId: otherGroup, userId: "user-a" },
        ]);

        type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
        function sessionFor(id: string): AuthSession {
          const now = new Date();
          return {
            user: {
              id, name: id, email: `${id}@example.test`, emailVerified: false,
              createdAt: now, updatedAt: now, image: null, isSuperAdmin: false,
            },
            session: {
              id: `session-${id}`, userId: id, token: `token-${id}`,
              expiresAt: new Date(now.getTime() + 3600000),
              createdAt: now, updatedAt: now, ipAddress: null, userAgent: null,
            },
          };
        }
        let activeSession: AuthSession | null = sessionFor("user-a");
        const sessionMock = t.mock.method(auth.api, "getSession", async () => activeSession);
        const transactionMock = t.mock.method(
          db,
          "transaction",
          async (callback: (transaction: typeof tx) => Promise<unknown>) =>
            callback(tx),
        );
        try {
          const idByName = new Map(
            teamRows.map((team) => [team.name, team.id]),
          );
          const idByGameId = new Map(before.map((game) => [game.gameId, game.id]));
          const currentBracket = () => {
            assert.ok(activeSession);
            return loadBracketFromDatabase(
              { userId: activeSession.user.id, groupId: mainGroup }, tx,
            );
          };
          const anonymous = await loadBracketFromDatabase(undefined, tx);
          assert.ok(bracketMatches(anonymous.state).every((match) => !match.winner));

          activeSession = null;
          const unauthorized = await PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT", body: JSON.stringify({ groupId: mainGroup, gameId: "east-r64-1", teamName: "Duke" }),
          }));
          assert.equal(unauthorized.status, 401);
          assert.equal((await DELETE(new Request(`http://localhost/api/games/winner?groupId=${mainGroup}`, {
            method: "DELETE",
          }))).status, 401);
          assert.equal((await tx.select().from(picks)).length, 0);
          activeSession = sessionFor("user-a");
          const invalidJson = await PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT", body: "{",
          }));
          assert.equal(invalidJson.status, 400);
          const unready = await PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT",
            body: JSON.stringify({ groupId: mainGroup, gameId: "championship", teamName: "Duke" }),
          }));
          assert.equal(unready.status, 409);
          const invalidTeam = await PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT",
            body: JSON.stringify({ groupId: mainGroup, gameId: "east-r64-1", teamName: "Not a participant" }),
          }));
          assert.equal(invalidTeam.status, 400);
          const missingGroup = await PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT",
            body: JSON.stringify({ gameId: "east-r64-1", teamName: "Duke" }),
          }));
          assert.equal(missingGroup.status, 400);
          const notMember = await PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT",
            body: JSON.stringify({ groupId: outsiderGroup, gameId: "east-r64-1", teamName: "Duke" }),
          }));
          assert.equal(notMember.status, 404);
          assert.equal((await DELETE(new Request(
            `http://localhost/api/games/winner?groupId=${outsiderGroup}`, { method: "DELETE" },
          ))).status, 404);
          assert.equal((await tx.select().from(picks)).length, 0);

          async function pick(gameId: string, teamName: string, groupId = mainGroup) {
            const response = await PUT(
              new Request("http://localhost/api/games/winner", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupId, gameId, teamName, userId: "user-b" }),
              }),
            );
            const body = await response.json();
            assert.equal(response.status, 200, JSON.stringify(body));
            assert.ok(body.saved);
            const state: BracketState = body.state;
            assert.ok(state);
            assert.ok(activeSession);
            assert.deepEqual(state, (await loadBracketFromDatabase(
              { userId: activeSession.user.id, groupId }, tx,
            )).state);
            return state;
          }

          async function seedWinners(matches: Match[]) {
            for (const match of matches) {
              const winner = match.teams[0];
              assert.ok(winner, `Missing participant for ${match.id}`);
              const winnerTeamId = idByName.get(winner.name);
              assert.ok(winnerTeamId);
              assert.ok(activeSession);
              await tx.insert(picks).values({
                userId: activeSession.user.id, groupId: mainGroup,
                gameId: idByGameId.get(match.id)!, winnerTeamId,
              }).onConflictDoUpdate({
                target: [picks.userId, picks.groupId, picks.bracketNumber, picks.gameId],
                set: { winnerTeamId },
              });
            }
          }

          activeSession = sessionFor("user-b");
          let otherState = (await currentBracket()).state;
          const otherFirstFour = otherState.firstFour?.[0];
          assert.ok(otherFirstFour?.teams[1]);
          otherState = await pick(otherFirstFour.id, otherFirstFour.teams[1].name);
          const otherFirstRound = otherState.regions[0].rounds[0].matches[0];
          assert.ok(otherFirstRound.teams[1]);
          otherState = await pick(otherFirstRound.id, otherFirstRound.teams[1].name);
          const otherPicks = await tx.select().from(picks).where(eq(picks.userId, "user-b"));
          activeSession = sessionFor("user-a");
          assert.deepEqual((await currentBracket()).state, anonymous.state);

          let state = (await currentBracket()).state;
          for (const match of state.firstFour ?? []) {
            assert.ok(match.teams[0]);
            state = await pick(match.id, match.teams[0].name);
          }
          for (let round = 0; round < 4; round++) {
            await seedWinners(
              state.regions.flatMap((region) => region.rounds[round].matches),
            );
            state = (await currentBracket()).state;
          }
          await seedWinners(state.ff);
          state = (await currentBracket()).state;
          await seedWinners([state.championship]);
          state = (await currentBracket()).state;
          assert.equal(state.championship.winner?.name, "Duke");
          assert.equal(
            (await tx.select().from(picks).where(eq(picks.userId, "user-a"))).length,
            67,
          );

          // The same user's bracket in another group starts empty and is
          // edited and reset independently.
          const otherOwner = { userId: "user-a", groupId: otherGroup };
          assert.deepEqual(
            (await loadBracketFromDatabase(otherOwner, tx)).state, anonymous.state,
          );
          const otherGroupGame = state.regions[0].rounds[0].matches[0];
          assert.ok(otherGroupGame.teams[1]);
          const otherGroupState = await pick(
            otherGroupGame.id, otherGroupGame.teams[1].name, otherGroup,
          );
          assert.equal(
            otherGroupState.regions[0].rounds[0].matches[0].winner?.name,
            otherGroupGame.teams[1].name,
          );
          assert.deepEqual((await currentBracket()).state, state);
          const pickRows = (userId: string, groupId: string) =>
            tx.select().from(picks).where(
              and(eq(picks.userId, userId), eq(picks.groupId, groupId)),
            );
          assert.equal((await pickRows("user-a", otherGroup)).length, 1);
          const mainGroupRows = await pickRows("user-a", mainGroup);
          assert.equal((await DELETE(new Request(
            `http://localhost/api/games/winner?groupId=${otherGroup}`, { method: "DELETE" },
          ))).status, 200);
          // Reset removes the rows themselves, and only for the selected group.
          assert.equal((await pickRows("user-a", otherGroup)).length, 0);
          assert.deepEqual(await pickRows("user-a", mainGroup), mainGroupRows);
          assert.deepEqual(
            (await loadBracketFromDatabase(otherOwner, tx)).state, anonymous.state,
          );
          assert.deepEqual((await currentBracket()).state, state);

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
          assert.equal((await tx.select().from(picks).where(and(
            eq(picks.userId, "user-a"), eq(picks.winnerTeamId, idByName.get("Duke")!),
          ))).length, 0);
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
          assert.deepEqual((await loadBracketFromDatabase(
            { userId: "user-b", groupId: mainGroup }, tx,
          )).state, otherState);
          assert.deepEqual(
            await tx.select().from(picks).where(eq(picks.userId, "user-b")), otherPicks,
          );

          // Joining a group can start from a copy of an existing bracket,
          // which then changes independently of the original.
          const copiedGroup = randomUUID();
          await tx.insert(groups).values({ id: copiedGroup, name: "Copied" });
          assert.ok(await joinGroup("user-a", copiedGroup, mainGroup));
          const copiedOwner = { userId: "user-a", groupId: copiedGroup };
          assert.deepEqual((await loadBracketFromDatabase(copiedOwner, tx)).state, state);
          const copiedState = await pick(
            preliminary.id, preliminary.teams[0]!.name, copiedGroup,
          );
          assert.notDeepEqual(copiedState, state);
          assert.deepEqual((await currentBracket()).state, state);
          // Copying from a group the user does not belong to copies nothing.
          assert.ok(await joinGroup("user-b", otherGroup, mainGroup));
          assert.deepEqual(
            (await loadBracketFromDatabase({ userId: "user-b", groupId: otherGroup }, tx)).state,
            otherState,
          );
          assert.ok(await joinGroup("user-b", outsiderGroup, copiedGroup));
          assert.deepEqual(
            (await loadBracketFromDatabase({ userId: "user-b", groupId: outsiderGroup }, tx)).state,
            anonymous.state,
          );

          // Private groups admit only those with the PIN; members need none.
          const privateGroup = randomUUID();
          await tx.insert(groups).values({
            id: privateGroup, name: "Private", isPrivate: true, joinPin: "4321",
          });
          assert.equal(await joinGroup("user-b", privateGroup), "wrong-pin");
          assert.equal(await joinGroup("user-b", privateGroup, undefined, "1234"), "wrong-pin");
          assert.equal(
            (await tx.select().from(groupMembers).where(eq(groupMembers.groupId, privateGroup))).length,
            0,
          );
          assert.deepEqual(
            await joinGroup("user-b", privateGroup, undefined, "4321"),
            { id: privateGroup, name: "Private", role: "member" },
          );
          assert.deepEqual(
            await joinGroup("user-b", privateGroup),
            { id: privateGroup, name: "Private", role: "member" },
          );

          await tx.delete(groupMembers).where(and(
            eq(groupMembers.userId, "user-b"), eq(groupMembers.groupId, otherGroup),
          ));

          // The sign-in group chooser summarizes each of the user's brackets.
          const choices = await listBracketChoices("user-a", tx);
          const mainChoice = choices.find((choice) => choice.id === mainGroup);
          assert.equal(
            mainChoice?.pickCount,
            bracketMatches(state).filter((match) => match.winner).length,
          );
          assert.equal(mainChoice?.champion, state.championship.winner?.name ?? null);
          assert.deepEqual(
            choices.find((choice) => choice.id === otherGroup),
            { id: otherGroup, name: "Other", role: "member", pickCount: 0, champion: null },
          );

          // Switching into a group with no picks offers the user's other
          // brackets; copying fills it once and never merges into picks.
          assert.deepEqual(
            (await pickSourcesFor("user-a", otherGroup, tx)).map((source) => source.id).sort(),
            [mainGroup, copiedGroup].sort(),
          );
          assert.deepEqual(await pickSourcesFor("user-a", mainGroup, tx), []);
          assert.equal(
            await copyPicksIntoEmptyGroup("user-a", outsiderGroup, otherGroup), "no-source",
          );
          assert.equal(
            await copyPicksIntoEmptyGroup("user-a", mainGroup, outsiderGroup), "not-member",
          );
          assert.equal(await copyPicksIntoEmptyGroup("user-a", mainGroup, otherGroup), "copied");
          assert.deepEqual(
            (await loadBracketFromDatabase(otherOwner, tx)).state,
            (await currentBracket()).state,
          );
          assert.equal(
            await copyPicksIntoEmptyGroup("user-a", copiedGroup, otherGroup), "not-empty",
          );
          assert.deepEqual(await pickSourcesFor("user-a", otherGroup, tx), []);
          assert.deepEqual(
            (await loadBracketFromDatabase(undefined, tx)).state, anonymous.state,
          );

          // Up to three brackets per group, each with its own picks.
          activeSession = sessionFor("user-a");
          const firstBracket = await loadBracketFromDatabase(
            { userId: "user-a", groupId: mainGroup }, tx,
          );
          const putInBracket = (bracket: unknown) => PUT(new Request("http://localhost/api/games/winner", {
            method: "PUT",
            body: JSON.stringify({ groupId: mainGroup, bracket, gameId: "east-r64-1", teamName: "Siena" }),
          }));
          assert.equal((await putInBracket(2)).status, 404, "bracket 2 must be created first");
          assert.equal((await putInBracket(4)).status, 400);
          assert.equal((await putInBracket("two")).status, 400);
          assert.deepEqual(await listBrackets("user-a", mainGroup, tx), [
            { number: 1, name: DEFAULT_BRACKET_NAME },
          ]);
          assert.deepEqual(await createBracket("user-a", mainGroup, "Upsets"), { number: 2, name: "Upsets" });
          assert.deepEqual(await createBracket("user-a", mainGroup, "Chalk"), { number: 3, name: "Chalk" });
          assert.equal(await createBracket("user-a", mainGroup, "Fourth"), "full");
          assert.equal(await createBracket("user-a", outsiderGroup, "Nope"), "not-member");
          assert.deepEqual(
            (await listBrackets("user-a", mainGroup, tx)).map((bracket) => bracket.name),
            [DEFAULT_BRACKET_NAME, "Upsets", "Chalk"],
          );
          assert.deepEqual(await listBrackets("user-b", mainGroup, tx), [
            { number: 1, name: DEFAULT_BRACKET_NAME },
          ]);
          // Naming the first bracket names bracket 1, once, and keeps its picks.
          assert.equal(await hasNamedBracket("user-b", mainGroup, tx), false);
          const userBFirst = await loadBracketFromDatabase({ userId: "user-b", groupId: mainGroup }, tx);
          assert.deepEqual(
            await createBracket("user-b", mainGroup, "B's picks", { first: true }),
            { number: 1, name: "B's picks" },
          );
          assert.equal(await createBracket("user-b", mainGroup, "Again", { first: true }), "exists");
          assert.equal(await hasNamedBracket("user-b", mainGroup, tx), true);
          assert.deepEqual(await listBrackets("user-b", mainGroup, tx), [
            { number: 1, name: "B's picks" },
          ]);
          assert.deepEqual(
            (await loadBracketFromDatabase({ userId: "user-b", groupId: mainGroup }, tx)).state,
            userBFirst.state,
          );
          assert.deepEqual(await createBracket("user-b", mainGroup, "B two"), { number: 2, name: "B two" });
          const secondPick = await putInBracket(2);
          assert.equal(secondPick.status, 200);
          const secondOwner = { userId: "user-a", groupId: mainGroup, bracketNumber: 2 };
          const secondState = (await loadBracketFromDatabase(secondOwner, tx)).state;
          assert.deepEqual((await secondPick.json()).state, secondState);
          assert.equal(
            bracketMatches(secondState).find((match) => match.id === "east-r64-1")?.winner?.name,
            "Siena",
          );
          assert.deepEqual(
            (await loadBracketFromDatabase({ userId: "user-a", groupId: mainGroup }, tx)).state,
            firstBracket.state,
            "picks in bracket 2 must not touch bracket 1",
          );
          assert.deepEqual(
            (await loadBracketFromDatabase({ ...secondOwner, bracketNumber: 3 }, tx)).state,
            anonymous.state,
          );
          const resetSecond = await DELETE(new Request(
            `http://localhost/api/games/winner?groupId=${mainGroup}&bracket=2`, { method: "DELETE" },
          ));
          assert.equal(resetSecond.status, 200);
          assert.deepEqual((await resetSecond.json()).state, anonymous.state);
          assert.deepEqual(
            (await loadBracketFromDatabase({ userId: "user-a", groupId: mainGroup }, tx)).state,
            firstBracket.state,
            "resetting bracket 2 must not touch bracket 1",
          );
          // A user's extra brackets don't show up as sources for copying.
          assert.equal(
            (await listBracketChoices("user-a", tx)).find((choice) => choice.id === mainGroup)?.pickCount,
            bracketMatches(firstBracket.state).filter((match) => match.winner).length,
          );

          const olderGameId = randomUUID();
          await tx.insert(games).values({
            id: olderGameId, gameId: "previous-tournament", year: 2025,
            round: "First Round", team1Id: teamRows[0].id, team2Id: teamRows[1].id,
          });
          await tx.insert(picks).values({
            userId: "user-a", groupId: mainGroup, gameId: olderGameId,
            winnerTeamId: teamRows[0].id,
          });
          const response = await DELETE(new Request(`http://localhost/api/games/winner?groupId=${mainGroup}`, {
            method: "DELETE",
          }));
          assert.equal(response.status, 200);
          assert.deepEqual((await response.json()).state, anonymous.state);
          assert.equal((await tx.select().from(picks).where(and(
            eq(picks.userId, "user-a"), eq(picks.gameId, olderGameId),
          ))).length, 1);
          // Only the older tournament's row survives in the reset group.
          assert.equal((await tx.select().from(picks).where(and(
            eq(picks.userId, "user-a"), eq(picks.groupId, mainGroup),
          ))).length, 1);
          assert.deepEqual((await loadBracketFromDatabase(
            { userId: "user-b", groupId: mainGroup }, tx,
          )).state, otherState);
          assert.deepEqual(
            await tx.select().from(games).where(eq(games.year, 2026)).orderBy(games.id),
            before,
          );
        } finally {
          transactionMock.mock.restore();
          sessionMock.mock.restore();
        }
        throw rollback;
      }),
      (error) => error === rollback,
    );
    assert.deepEqual(await db.select().from(games).orderBy(games.id), before);
  } finally {
    await db.$client.end();
  }
});
