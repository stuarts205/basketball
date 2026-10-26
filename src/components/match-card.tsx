import { CARD_H, CARD_W, Match, ROW_H, Team } from "@/lib/types";
import Image from "next/image";
import React from "react";
import { getTeamLogoUrl } from "@/lib/team-logos";

export const MatchCard = ({
  match,
  onSelectTeam,
  width = CARD_W,
}: {
  match: Match;
  onSelectTeam: (match: Match, team: Team) => void;
  width?: number | string;
}) => {
  return (
    <div
      className="pointer-events-auto shrink-0 flex flex-col justify-center bg-white rounded-lg shadow-md overflow-hidden"
      style={{ width, height: CARD_H }}
    >
      {match.actualWinner && (
        <div
          className="flex shrink-0 items-center justify-between gap-1 px-3 text-[8px] leading-3"
          style={{ height: CARD_H - ROW_H * 2 - 2 }}
        >
          <span className="min-w-0 truncate text-gray-500">
            Sim: {match.actualWinner.name}
          </span>
          {match.winner && (
            <span
              className={`shrink-0 font-bold ${match.winner.name === match.actualWinner.name ? "text-green-700" : "text-red-600"}`}
            >
              {match.winner.name === match.actualWinner.name ? "OK" : "MISS"}
            </span>
          )}
        </div>
      )}
      {/* <div
        className="px-3 pt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
        style={{ height: CARD_H - ROW_H * 2 }}
      >
        {match.status === "final"
          ? "Final"
          : match.status === "live"
            ? "Live"
            : ""}
      </div> */}
      {match.teams.map((team, i) => {
        const pendingTeams = !team
          ? match.pendingTeams?.[i as 0 | 1]
          : undefined;
        const teamName =
          team?.name ??
          pendingTeams?.map((candidate) => candidate.name).join("/") ??
          "";
        const isWinner = team != null && match.winner?.name === team.name;
        const isActualWinner =
          team != null && match.actualWinner?.name === team.name;
        const isActualLoser =
          team != null &&
          match.actualWinner != null &&
          match.actualTeams?.some(
            (actualTeam) => actualTeam?.name === team.name,
          ) &&
          !isActualWinner;
        const isMissedPick =
          isWinner && match.actualWinner != null && !isActualWinner;
        const score = match.score[i];
        const logoUrl = team
          ? team.logo || getTeamLogoUrl(team.name)
          : undefined;
        return (
          <button
            key={i}
            title={teamName || undefined}
            onClick={() => team && onSelectTeam(match, team)}
            disabled={!team}
            style={{ height: ROW_H, width: "100%" }}
            className={[
              "flex items-center gap-2 px-3 text-left transition-colors",
              i > 0 ? "border-t border-gray-100" : "",
              isMissedPick
                ? "font-bold text-red-700"
                : isActualWinner
                  ? "font-bold text-green-800"
                  : isWinner
                    ? "font-bold text-gray-900"
                    : "text-gray-400",
              isActualLoser ? "opacity-60" : "",
              team && !isWinner ? "hover:bg-gray-50 cursor-pointer" : "",
              !team ? "cursor-default" : "",
            ].join(" ")}
          >
            <span
              className={`text-[11px] w-4 shrink-0 ${isWinner ? "text-gray-500" : "text-gray-300"}`}
            >
              {team?.seed ?? pendingTeams?.[0]?.seed ?? ""}
            </span>
            {logoUrl && (
              <Image
                src={logoUrl}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 shrink-0 object-contain"
              />
            )}
            <span
              className={`min-w-0 flex-1 ${pendingTeams ? "text-[10px] leading-3 whitespace-normal break-words text-gray-500" : "truncate text-sm"} ${isActualLoser ? "line-through" : ""}`}
            >
              {teamName}
            </span>
            {isWinner && match.actualWinner && (
              <span
                aria-label={isMissedPick ? "Pick missed" : "Correct pick"}
                className={`shrink-0 text-sm font-bold ${isMissedPick ? "text-red-600" : "text-green-600"}`}
              >
                {isMissedPick ? "×" : "✓"}
              </span>
            )}
            {score != null && (
              <span
                className={`text-sm tabular-nums ${isWinner ? "text-gray-900" : "text-gray-400"}`}
              >
                {score}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
