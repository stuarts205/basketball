import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { games, picks, teams, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { bracketMatches, loadBracketFromDatabase } from "@/lib/load-bracket";

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json({ error: "Sign in to reset picks" }, { status: 401 });

    const result = await db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, session.user.id))
        .for("update");
      const bracket = await loadBracketFromDatabase(session.user.id, tx);
      const tournamentGames = await tx
        .select({ id: games.id })
        .from(games)
        .where(eq(games.year, bracket.year));
      await tx
        .delete(picks)
        .where(
          and(
            eq(picks.userId, session.user.id),
            inArray(picks.gameId, tournamentGames.map((game) => game.id)),
          ),
        );
      return loadBracketFromDatabase(session.user.id, tx);
    });
    return Response.json(result);
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("gameId" in body) ||
      typeof body.gameId !== "string" ||
      !("teamName" in body) ||
      typeof body.teamName !== "string"
    ) {
      return Response.json(
        { error: "gameId and teamName are required" },
        { status: 400 },
      );
    }
    const { gameId, teamName } = body;

    const result = await db.transaction(async (tx) => {
      // Serialize edits for this user without locking other users' brackets.
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, session.user.id))
        .for("update");
      const bracket = await loadBracketFromDatabase(session.user.id, tx);
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
          gameId: game.id,
          winnerTeamId: team.id,
        })
        .onConflictDoUpdate({
          target: [picks.userId, picks.gameId],
          set: { winnerTeamId: team.id },
        });

      const updated = await loadBracketFromDatabase(session.user.id, tx);
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
          and(eq(picks.userId, session.user.id), eq(games.year, bracket.year)),
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
