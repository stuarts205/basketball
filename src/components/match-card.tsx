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
  const pickedCorrectly =
    match.winner != null &&
    match.actualWinner != null &&
    match.winner.name === match.actualWinner.name;
  // A game with a result can't be picked any more.
  const finished = match.status === "final" || match.actualWinner != null;
  return (
    <div
      className={`pointer-events-auto shrink-0 flex flex-col justify-center bg-white rounded-lg shadow-md overflow-hidden ${pickedCorrectly ? "ring-2 ring-green-600" : ""}`}
      style={{ width, height: CARD_H }}
    >
      {match.actualWinner && (
        <div
          className="flex shrink-0 items-center justify-between gap-1 px-3 text-[8px] leading-3"
          style={{ height: CARD_H - ROW_H * 2 - 2 }}
        >
          <span className="min-w-0 truncate text-gray-500">
            Winner: {match.actualWinner.name}
          </span>
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
        // A team the user advanced here that was knocked out in an earlier game.
        const actualTeam = match.actualTeams?.[i];
        const isEliminated =
          team != null && actualTeam != null && actualTeam.name !== team.name;
        // Show the team that actually advanced, keeping the user's pick as a note.
        const shownTeam = isEliminated ? actualTeam : team;
        const shownName = isEliminated ? actualTeam.name : teamName;
        const isWinner = team != null && match.winner?.name === team.name;
        const isActualWinner =
          shownTeam != null && match.actualWinner?.name === shownTeam.name;
        const isCorrectPick = isWinner && isActualWinner;
        const isMissedPick =
          isWinner &&
          match.actualWinner != null &&
          match.actualWinner.name !== team.name;
        const isStruck = isMissedPick || isEliminated;
        const score = match.score[i];
        const logoUrl = shownTeam
          ? shownTeam.logo || getTeamLogoUrl(shownTeam.name)
          : undefined;
        return (
          <button
            key={i}
            title={
              isEliminated
                ? `${shownName} (your pick: ${teamName})`
                : teamName || undefined
            }
            onClick={() => team && !finished && onSelectTeam(match, team)}
            disabled={!team || finished}
            style={{ height: ROW_H, width: "100%" }}
            className={[
              "flex items-center gap-2 px-3 text-left transition-colors",
              i > 0 ? "border-t border-gray-100" : "",
              isCorrectPick
                ? "font-bold text-green-700"
                : isWinner
                    ? "font-bold text-gray-900"
                    : "text-gray-400",
              team && !isWinner && !finished
                ? "hover:bg-gray-50 cursor-pointer"
                : "",
              !team || finished ? "cursor-default" : "",
            ].join(" ")}
          >
            <span
              className={`text-[11px] w-4 shrink-0 ${isWinner ? "text-gray-500" : "text-gray-300"}`}
            >
              {shownTeam?.seed ?? pendingTeams?.[0]?.seed ?? ""}
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
              className={`min-w-0 flex-1 ${pendingTeams ? "text-[10px] leading-3 whitespace-normal break-words text-gray-500" : "truncate text-sm"}`}
            >
              {shownName}
              {isEliminated && (
                <span className="ml-1 text-[9px] font-normal text-red-400 line-through">
                  {teamName}
                </span>
              )}
            </span>
            {isStruck ? (
              <span
                aria-label="Pick missed"
                className="shrink-0 text-sm font-bold text-red-600"
              >
                ✕
              </span>
            ) : (
              isCorrectPick && (
                <span
                  aria-label="Correct pick"
                  className="shrink-0 text-sm font-bold text-green-600"
                >
                  ✓
                </span>
              )
            )}
            {score != null && (
              <span
                className={`shrink-0 text-sm tabular-nums ${(match.actualWinner ? isActualWinner : isWinner) ? "font-bold text-gray-900" : "font-normal text-gray-400"}`}
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
