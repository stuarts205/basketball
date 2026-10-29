import { Match, Team } from "@/lib/types";
import Image from "next/image";
import React from "react";
import { isFinished, pickedCorrectly, slotInfo } from "./match-card";

// The title game, drawn larger than the other games: each team gets a panel
// with a big logo, and the scores face each other in the middle. Clicking a
// team's panel picks it, as in MatchCard.
export const ChampionshipCard = ({
  match,
  onSelectTeam,
  width,
}: {
  match: Match;
  onSelectTeam: (match: Match, team: Team) => void;
  width: number | string;
}) => {
  const finished = isFinished(match);
  return (
    <div
      className={`pointer-events-auto rounded-xl bg-white px-4 pb-4 pt-3 text-center shadow-lg ${pickedCorrectly(match) ? "ring-2 ring-green-600" : ""}`}
      style={{ width }}
    >
      <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">
        Championship Game
      </h2>
      <p className="mb-3 h-4 text-xs font-bold text-gray-500">
        {finished ? "Final" : ""}
      </p>
      <div className="flex overflow-hidden rounded-lg border border-gray-200">
        {[0, 1].map((i) => (
          <TeamPanel
            key={i}
            match={match}
            index={i}
            finished={finished}
            onSelectTeam={onSelectTeam}
          />
        ))}
      </div>
    </div>
  );
};

function TeamPanel({
  match,
  index,
  finished,
  onSelectTeam,
}: {
  match: Match;
  index: number;
  finished: boolean;
  onSelectTeam: (match: Match, team: Team) => void;
}) {
  const {
    team,
    pendingTeams,
    teamName,
    isEliminated,
    shownTeam,
    shownName,
    isWinner,
    isCorrectPick,
    isStruck,
    isLeading,
    score,
    logoUrl,
  } = slotInfo(match, index);
  const left = index === 0;
  const scoreEl = score != null && (
    <span
      className={`shrink-0 text-3xl font-black tabular-nums ${isLeading ? "text-gray-900" : "text-gray-400"}`}
    >
      {score}
    </span>
  );
  return (
    <button
      type="button"
      title={
        isEliminated
          ? `${shownName} (your pick: ${teamName})`
          : teamName || undefined
      }
      onClick={() => team && !finished && onSelectTeam(match, team)}
      disabled={!team || finished}
      className={[
        "relative flex min-w-0 flex-1 items-center gap-2 px-3 py-3 transition-colors",
        left ? "" : "flex-row-reverse",
        isLeading ? "bg-white" : "bg-gray-50",
        team && !isWinner && !finished
          ? "cursor-pointer hover:bg-gray-100"
          : "cursor-default",
      ].join(" ")}
    >
      {/* The winning side's inner edge is marked, like the bar between the
          two scores. */}
      {isLeading && (
        <span
          aria-hidden
          className={`absolute inset-y-0 w-1 bg-ball-500 ${left ? "right-0" : "left-0"}`}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-300"
          >
            ?
          </span>
        )}
        <span
          className={`flex max-w-full items-baseline gap-1 text-sm ${isCorrectPick ? "font-bold text-green-700" : isLeading ? "font-bold text-gray-900" : "font-semibold text-gray-500"}`}
        >
          <span className="text-[11px] font-normal text-gray-400">
            {shownTeam?.seed ?? pendingTeams?.[0]?.seed ?? ""}
          </span>
          <span className="min-w-0 truncate">{shownName || "TBD"}</span>
          {isStruck ? (
            <span aria-label="Pick missed" className="font-bold text-red-600">
              ✕
            </span>
          ) : (
            isCorrectPick && (
              <span aria-label="Correct pick" className="font-bold text-green-600">
                ✓
              </span>
            )
          )}
        </span>
        {isEliminated && (
          <span className="max-w-full truncate text-[10px] text-red-400 line-through">
            {teamName}
          </span>
        )}
      </span>
      {scoreEl}
    </button>
  );
}
