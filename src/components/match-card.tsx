import { CARD_H, CARD_W, Match, ROW_H, Team } from "@/lib/types";
import React from "react";

export const MatchCard = ({
  match,
  onSelectTeam,
  width = CARD_W,
}: {
  match: Match;
  onSelectTeam: (match: Match, team: Team) => void;
  width?: number;
}) => {
  return (
    <div
      className="shrink-0 bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
      style={{ width, height: CARD_H }}
    >
      <div
        className="px-3 pt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
        style={{ height: CARD_H - ROW_H * 2 }}
      >
        {match.status === "final"
          ? "Final"
          : match.status === "live"
            ? "Live"
            : ""}
      </div>
      {match.teams.map((team, i) => {
        const isWinner = team != null && match.winner?.name === team.name;
        const score = match.score[i];
        return (
          <button
            key={i}
            onClick={() => team && onSelectTeam(match, team)}
            disabled={!team}
            style={{ height: ROW_H, width: "100%" }}
            className={[
              "flex items-center gap-2 px-3 text-left transition-colors border-t border-gray-100",
              isWinner ? "font-bold text-gray-900" : "text-gray-400",
              team && !isWinner ? "hover:bg-gray-50 cursor-pointer" : "",
              !team ? "cursor-default" : "",
            ].join(" ")}
          >
            <span
              className={`text-[11px] w-4 shrink-0 ${isWinner ? "text-gray-500" : "text-gray-300"}`}
            >
              {team?.seed ?? ""}
            </span>
            <span className="flex-1 truncate text-sm">
              {team?.name ?? "TBD"}
            </span>
            {score != null && (
              <span
                className={`text-sm tabular-nums ${isWinner ? "text-gray-900" : "text-gray-400"}`}
              >
                {score}
              </span>
            )}
            {isWinner && score != null && (
              <span className="text-gray-400 text-xs ml-1">◀</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
