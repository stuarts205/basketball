import { auth } from "@/lib/auth";
import { gameIdFor } from "@/lib/bracket-source";
import { fetchTournament } from "@/lib/import-tournament";
import { ActualResults } from "@/lib/simulate";

// The real results, read straight from ESPN. Nothing is saved. Only the super
// admin can load them.
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to load the results" },
        { status: 401 },
      );
    if (!session.user.isSuperAdmin)
      return Response.json(
        { error: "Only the super admin can load the results" },
        { status: 403 },
      );

    const bracket = await fetchTournament();
    const results: ActualResults = { winners: {}, points: {} };
    for (const game of bracket.matchups) {
      if (game.statusState !== "post") continue;
      const gameId = gameIdFor(bracket, game);
      const competitors = [game.competitorOne, game.competitorTwo];
      const winner = competitors.find((team) => team?.winner);
      if (!winner) continue;
      // Our teams are named by location, e.g. "NC State".
      results.winners[gameId] = winner.location;
      results.points[gameId] = Object.fromEntries(
        competitors
          .filter((team) => team?.score)
          .map((team) => [team.location, Number(team.score)]),
      );
    }
    return Response.json(results);
  } catch (error) {
    console.error("Could not load the tournament results", error);
    return Response.json(
      { error: "Could not load the tournament results" },
      { status: 502 },
    );
  }
}
