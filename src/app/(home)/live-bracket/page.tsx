import React from "react";
import { LiveBracketView } from "@/components/live-bracket-view";
import { loadCbsBracket } from "@/lib/cbs-bracket";

export const dynamic = "force-dynamic";

export default async function LiveBracket() {
  let bracket: Awaited<ReturnType<typeof loadCbsBracket>> | null = null;
  try {
    bracket = await loadCbsBracket();
  } catch (error) {
    console.error("Could not load the live bracket", error);
  }

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1 text-gray-800">
            {bracket ? `${bracket.year} NCAA Tournament` : "NCAA Tournament"}
          </h1>
          <p className="text-sm text-gray-400">
            Every game and result in the tournament
          </p>
        </div>
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
