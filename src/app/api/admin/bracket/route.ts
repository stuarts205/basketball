import { db } from "@/db";
import { games } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  importTournament,
  loadTournament,
  validateTournament,
} from "@/lib/import-tournament";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to set up the bracket" },
        { status: 401 },
      );
    if (!session.user.isSuperAdmin)
      return Response.json(
        { error: "Only the super admin can set up the bracket" },
        { status: 403 },
      );

    const [existing] = await db.select({ id: games.id }).from(games).limit(1);
    if (existing)
      return Response.json(
        { error: "The bracket is already set up" },
        { status: 409 },
      );

    const bracket = await loadTournament();
    const teamRows = await validateTournament(bracket);
    await importTournament(db, bracket, teamRows);
    return Response.json({ teams: teamRows.size, games: bracket.matchups.length });
  } catch (error) {
    console.error("Could not load the bracket", error);
    return Response.json(
      { error: "Could not load the bracket" },
      { status: 500 },
    );
  }
}
