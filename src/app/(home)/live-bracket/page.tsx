import React from "react";
import { LiveBracketView } from "@/components/live-bracket-view";
import { PageHeader } from "@/components/page-header";
import { loadBracketFromDatabase } from "@/lib/load-bracket";
import { resultsAsBracket } from "@/lib/simulate";
import { BracketState } from "@/lib/types";

export const dynamic = "force-dynamic";

// Draws the saved tournament results, the same ones every bracket is scored
// against, for now the super admin's simulations. The real results can still
// be read from CBS with loadCbsBracket in @/lib/cbs-bracket.
export default async function LiveBracket() {
  let bracket: { year: number; state: BracketState } | null = null;
  try {
    const { year, state, results, scores } = await loadBracketFromDatabase();
    bracket = { year, state: resultsAsBracket(state, results, scores) };
  } catch (error) {
    console.error("Could not load the live bracket", error);
  }

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <PageHeader
          title={bracket ? `${bracket.year} NCAA Tournament` : "NCAA Tournament"}
          subtitle="Every game and result in the tournament"
        />
        {bracket ? (
          <LiveBracketView state={bracket.state} />
        ) : (
          <p role="alert" className="text-sm text-red-700">
            Could not load the tournament results. Try again in a minute.
          </p>
        )}
      </div>
    </div>
  );
}
