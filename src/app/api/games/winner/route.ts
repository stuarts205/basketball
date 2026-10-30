import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { games, picks, teams, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hasBracket, parseBracketNumber } from "@/lib/brackets";
import { UUID_PATTERN, findUserGroup } from "@/lib/groups";
import { bracketMatches, loadBracketFromDatabase } from "@/lib/load-bracket";

const notAMember = {
  status: 404,
  body: { error: "You are not a member of that group" },
} as const;

// The super admin runs the tournament and makes no picks.
const adminCannotPick = () =>
  Response.json(
    { error: "The super admin doesn't make picks" },
    { status: 403 },
  );

const noSuchBracket = {
  status: 404,
  body: { error: "You don't have that bracket in this group" },
} as const;

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json({ error: "Sign in to reset picks" }, { status: 401 });
    if (session.user.isSuperAdmin) return adminCannotPick();

    const params = new URL(request.url).searchParams;
    const groupId = params.get("groupId") ?? "";
    if (!UUID_PATTERN.test(groupId))
      return Response.json({ error: "groupId is required" }, { status: 400 });
    const bracketNumber = parseBracketNumber(params.get("bracket"));
    if (!bracketNumber)
      return Response.json({ error: "Invalid bracket" }, { status: 400 });
    const owner = { userId: session.user.id, groupId, bracketNumber };

    const result = await db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, session.user.id))
        .for("update");
      if (!(await findUserGroup(session.user.id, groupId, tx))) return notAMember;
      if (!(await hasBracket(session.user.id, groupId, bracketNumber, tx)))
        return noSuchBracket;
      const bracket = await loadBracketFromDatabase(owner, tx);
      const tournamentGames = await tx
        .select({ id: games.id })
        .from(games)
        .where(eq(games.year, bracket.year));
      await tx
        .delete(picks)
        .where(
          and(
            eq(picks.userId, session.user.id),
            eq(picks.groupId, groupId),
            eq(picks.bracketNumber, bracketNumber),
            inArray(picks.gameId, tournamentGames.map((game) => game.id)),
          ),
        );
      return { status: 200, body: await loadBracketFromDatabase(owner, tx) };
    });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Could not reset user picks", error);
    return Response.json({ error: "Could not reset picks" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json({ error: "Sign in to save picks" }, { status: 401 });
    if (session.user.isSuperAdmin) return adminCannotPick();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("groupId" in body) ||
      typeof body.groupId !== "string" ||
      !UUID_PATTERN.test(body.groupId) ||
      !("gameId" in body) ||
      typeof body.gameId !== "string" ||
      !("teamName" in body) ||
      typeof body.teamName !== "string"
    ) {
      return Response.json(
        { error: "groupId, gameId and teamName are required" },
        { status: 400 },
      );
    }
    const { groupId, gameId, teamName } = body;
    const bracketNumber = parseBracketNumber(
      "bracket" in body ? body.bracket : undefined,
    );
    if (!bracketNumber)
      return Response.json({ error: "Invalid bracket" }, { status: 400 });
    const owner = { userId: session.user.id, groupId, bracketNumber };

    const result = await db.transaction(async (tx) => {
      // Serialize edits for this user without locking other users' brackets.
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, session.user.id))
        .for("update");
      if (!(await findUserGroup(session.user.id, groupId, tx))) return notAMember;
      if (!(await hasBracket(session.user.id, groupId, bracketNumber, tx)))
        return noSuchBracket;
      const bracket = await loadBracketFromDatabase(owner, tx);
      const match = bracketMatches(bracket.state).find(
        (entry) => entry.id === gameId,
      );
      if (!match)
        return { status: 404, body: { error: "Pickable game not found" } };

      const [game] = await tx
        .select()
        .from(games)
        .where(and(eq(games.gameId, gameId), eq(games.year, bracket.year)));
      if (
        game.round !== "First Round" &&
        game.round !== "First Four" &&
        match.teams.some((team) => team === null)
      ) {
        return {
          status: 409,
          body: { error: "Both feeder games need winners before this pick" },
        };
      }
      if (game.actualWinnerTeamId)
        return { status: 409, body: { error: "This game is already over" } };
      if (!match.teams.some((team) => team?.name === teamName))
        return { status: 400, body: { error: "Team is not part of this game" } };

      const [team] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.name, teamName));
      if (!team)
        return { status: 400, body: { error: "Team not found" } };

      await tx
        .insert(picks)
        .values({
          userId: session.user.id,
          groupId,
          bracketNumber,
          gameId: game.id,
          winnerTeamId: team.id,
        })
        .onConflictDoUpdate({
          target: [
            picks.userId,
            picks.groupId,
            picks.bracketNumber,
            picks.gameId,
          ],
          set: { winnerTeamId: team.id },
        });

      const updated = await loadBracketFromDatabase(owner, tx);
      const validWinners = new Map(
        bracketMatches(updated.state).map((entry) => [
          entry.id,
          entry.winner?.name,
        ]),
      );
      const saved = await tx
        .select({
          gameId: picks.gameId,
          externalGameId: games.gameId,
          teamName: teams.name,
        })
        .from(picks)
        .innerJoin(games, eq(picks.gameId, games.id))
        .innerJoin(teams, eq(picks.winnerTeamId, teams.id))
        .where(
          and(
            eq(picks.userId, session.user.id),
            eq(picks.groupId, groupId),
            eq(picks.bracketNumber, bracketNumber),
            eq(games.year, bracket.year),
          ),
        );
      const invalidIds = saved
        .filter((pick) => validWinners.get(pick.externalGameId) !== pick.teamName)
        .map((pick) => pick.gameId);
      if (invalidIds.length) {
        await tx
          .delete(picks)
          .where(
            and(
              eq(picks.userId, session.user.id),
              eq(picks.groupId, groupId),
              eq(picks.bracketNumber, bracketNumber),
              inArray(picks.gameId, invalidIds),
            ),
          );
      }
      return { status: 200, body: { saved: true, ...updated } };
    });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Could not save user pick", error);
    return Response.json({ error: "Could not save pick" }, { status: 500 });
  }
}
