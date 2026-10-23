"use client";
import { FullBracket } from "@/components/full-bracket";

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-100 p-6 lg:px-3">
      <div className="w-full min-w-0 mx-auto">
        <h1 className="text-2xl font-bold mb-1 text-gray-800">
          2025 NCAA Tournament
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          Click any team to advance them to the next round
        </p>
        <FullBracket />
      </div>
    </div>
  );
}
