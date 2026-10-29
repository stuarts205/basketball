import {
  CARD_H,
  COL_LABEL_H,
  CONNECTOR_W,
  DESKTOP_REGION_GAP,
  Match,
  ROUND_NAMES_GAP,
  Team,
} from "@/lib/types";
import { roundLayout } from "@/lib/utils";
import React from "react";
import { ChampionCard } from "./champion-card";
import { ChampionshipCard } from "./championship-card";
import { MatchCard } from "./match-card";

export const FinalFourCenter = ({
  ff,
  championship,
  onSelectTeam,
}: {
  ff: Match[];
  championship: Match;
  onSelectTeam: (match: Match, team: Team) => void;
}) => {
  const { gap: firstRoundGap } = roundLayout(0);
  // A region's round-names row (24px) and the gap under it.
  const regionHeaderHeight = 24 + ROUND_NAMES_GAP;
  const regionGap = DESKTOP_REGION_GAP;
  const regionHeight =
    regionHeaderHeight + COL_LABEL_H + 8 * CARD_H + 7 * firstRoundGap;
  const totalH = regionHeight * 2 + regionGap;

  const champCenterY = regionHeight + regionGap / 2;
  const champY = champCenterY - CARD_H / 2;

  const FF_W = 200;
  const COL_W = FF_W + CONNECTOR_W * 2;
  const championshipWidth = 360;
  const championshipLeft = (COL_W - championshipWidth) / 2;
  const semifinalGap = CONNECTOR_W * 2;
  const leftSemifinal = championshipLeft - semifinalGap - FF_W;
  const rightSemifinal = championshipLeft + championshipWidth + semifinalGap;

  return (
    <div className="relative shrink-0" style={{ width: COL_W, height: totalH }}>
      <svg
        className="absolute inset-0 overflow-visible pointer-events-none"
        width={COL_W}
        height={totalH}
        aria-hidden="true"
      >
        <path
          d={`M ${leftSemifinal + FF_W} ${champCenterY} H ${championshipLeft}`}
          fill="none"
          stroke="#b8a48a"
          strokeWidth={1.75}
        />
        <path
          d={`M ${rightSemifinal} ${champCenterY} H ${championshipLeft + championshipWidth}`}
          fill="none"
          stroke="#b8a48a"
          strokeWidth={1.75}
        />
      </svg>
      <div
        className="absolute"
        style={{ left: leftSemifinal, top: champY, width: FF_W }}
      >
        <MatchCard match={ff[0]} onSelectTeam={onSelectTeam} width={FF_W} />
      </div>

      <div
        className="absolute"
        style={{ left: rightSemifinal, top: champY, width: FF_W }}
      >
        <MatchCard match={ff[1]} onSelectTeam={onSelectTeam} width={FF_W} />
      </div>

      {/* The title game is centered on the semifinal lines, with the
          champion just below it. */}
      <div
        className="absolute"
        style={{
          left: championshipLeft,
          top: champCenterY,
          width: championshipWidth,
          transform: "translateY(-50%)",
        }}
      >
        <ChampionshipCard
          match={championship}
          onSelectTeam={onSelectTeam}
          width={championshipWidth}
        />
        {championship.winner && (
          <div className="absolute left-1/2 top-full mt-6 -translate-x-1/2">
            <ChampionCard team={championship.winner} />
          </div>
        )}
      </div>
    </div>
  );
};
