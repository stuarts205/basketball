import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { games, teams } from "@/db/schema";
import { bracketMatches, loadBracketFromDatabase } from "@/lib/load-bracket";
import { SimResults, SimScores, applyResults } from "@/lib/simulate";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Saves the tournament's results: the winning team's name by game id, and
// optionally each game's final score. Each winner must have played in that
// game given the earlier winners, so they are walked through the bracket
// first; games without a valid winner are cleared, score and all.
// Returns how many games now have a winner.
export async function saveActualResults(
  winners: SimResults,
  scores: SimScores = {},
  database: Pick<typeof db, "transaction"> = db,
): Promise<number> {
  return database.transaction(async (tx) => {
    const { state, year } = await loadBracketFromDatabase(undefined, tx);
    const decided = bracketMatches(applyResults(state, winners)).filter(
      (match) => match.actualWinner,
    );
    const teamRows = decided.length
      ? await tx
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(
            inArray(
              teams.name,
              decided.map((match) => match.actualWinner!.name),
            ),
          )
      : [];
    const teamIdByName = new Map(teamRows.map((team) => [team.name, team.id]));

    await clearActualResults(year, tx);
    for (const match of decided) {
      await tx
        .update(games)
        .set({
          actualWinnerTeamId: teamIdByName.get(match.actualWinner!.name)!,
          actualScore1: scores[match.id]?.[0] ?? null,
          actualScore2: scores[match.id]?.[1] ?? null,
        })
        .where(and(eq(games.gameId, match.id), eq(games.year, year)));
    }
    return decided.length;
  });
}

async function clearActualResults(year: number, tx: Transaction) {
  await tx
    .update(games)
    .set({ actualWinnerTeamId: null, actualScore1: null, actualScore2: null })
    .where(eq(games.year, year));
}

// Clears every result in the current tournament: each game's actual winner
// and score. Players' picks are kept.
export async function resetActualResults(
  database: Pick<typeof db, "transaction"> = db,
) {
  await database.transaction(async (tx) => {
    const { year } = await loadBracketFromDatabase(undefined, tx);
    await clearActualResults(year, tx);
  });
}
