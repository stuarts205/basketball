import { loadBracketFromDatabase } from "@/lib/load-bracket";
import { FullBracket } from "@/components/full-bracket";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { state, year } = await loadBracketFromDatabase();

  return (
    <div className="min-h-screen bg-gray-100 p-6 lg:px-3">
      <div className="w-full min-w-0 mx-auto">
        <h1 className="text-2xl font-bold mb-1 text-gray-800">
          {year} NCAA Tournament
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          Click any team to advance them to the next round
        </p>
        <FullBracket initialState={state} />
      </div>
    </div>
  );
}
