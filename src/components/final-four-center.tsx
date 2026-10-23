import { CARD_H, COL_LABEL_H, CONNECTOR_W, Match, Team } from "@/lib/types";
import { roundLayout } from "@/lib/utils";
import React from "react";
import { ChampionCard } from "./champion-card";
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
  const { topPad: eliteEightTopPad } = roundLayout(3);
  const regionHeaderHeight = 24;
  const regionGap = 32;
  const regionHeight =
    regionHeaderHeight + COL_LABEL_H + 8 * CARD_H + 7 * firstRoundGap;
  const totalH = regionHeight * 2 + regionGap - COL_LABEL_H;

  const region0CenterY = regionHeaderHeight + eliteEightTopPad + CARD_H / 2;
  const region1CenterY = region0CenterY + regionHeight + regionGap;
  const champCenterY = (region0CenterY + region1CenterY) / 2;
  const semifinalOffset = (regionHeight + regionGap) * 0.3;
  const semi0CenterY = champCenterY - semifinalOffset;
  const semi1CenterY = champCenterY + semifinalOffset;
  const semi0Y = semi0CenterY - CARD_H / 2;
  const semi1Y = semi1CenterY - CARD_H / 2;
  const champY = champCenterY - CARD_H / 2;
  const spineX = CONNECTOR_W / 2;

  const FF_W = 200;
  const COL_W = FF_W + CONNECTOR_W * 2;

  return (
    <div
      className="shrink-0 flex flex-col items-center"
      style={{ width: COL_W }}
    >
      {/* Header */}
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height: COL_LABEL_H }}
      >
        <div className="text-[10px] font-bold uppercase leading-3 tracking-widest text-gray-400">
          Final Four
        </div>
      </div>

      {/* SVG for connector lines from Elite 8 → FF → Championship */}
      <div
        className="relative shrink-0"
        style={{ height: totalH, width: COL_W }}
      >
        {/* Left connector: Elite 8 → left semifinal */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          width={COL_W}
          height={totalH}
        >
          {/* Line from left E8 (right edge) to FF semi 0 */}
          <path
            d={`M 0 ${region0CenterY} H ${spineX} V ${semi0CenterY} H ${CONNECTOR_W}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
          {/* Line from left E8 (right edge) to FF semi 1 */}
          <path
            d={`M 0 ${region1CenterY} H ${spineX} V ${semi1CenterY} H ${CONNECTOR_W}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
          {/* Vertical bar connecting semi0 and semi1 on left */}
          <path
            d={`M ${spineX} ${semi0CenterY} V ${semi1CenterY}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
          {/* Line from midpoint of semis to championship */}
          <path
            d={`M ${spineX} ${champCenterY} H ${CONNECTOR_W + 16}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />

          {/* Right connector: right E8 → FF */}
          <path
            d={`M ${COL_W} ${region0CenterY} H ${COL_W - spineX} V ${semi0CenterY} H ${COL_W - CONNECTOR_W}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
          <path
            d={`M ${COL_W} ${region1CenterY} H ${COL_W - spineX} V ${semi1CenterY} H ${COL_W - CONNECTOR_W}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
          <path
            d={`M ${COL_W - spineX} ${semi0CenterY} V ${semi1CenterY}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
          <path
            d={`M ${COL_W - spineX} ${champCenterY} H ${COL_W - CONNECTOR_W - 16}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.75}
          />
        </svg>
        {championship.winner && (
          <div
            className="absolute"
            style={{ left: (COL_W - 220) / 2, top: 176 }}
          >
            <ChampionCard team={championship.winner} />
          </div>
        )}

        {/* Left semifinal card */}
        <div
          className="absolute"
          style={{ left: CONNECTOR_W, top: semi0Y, width: FF_W }}
        >
          <MatchCard match={ff[0]} onSelectTeam={onSelectTeam} width={FF_W} />
        </div>

        {/* Right semifinal card */}
        <div
          className="absolute"
          style={{ left: CONNECTOR_W, top: semi1Y, width: FF_W }}
        >
          <MatchCard match={ff[1]} onSelectTeam={onSelectTeam} width={FF_W} />
        </div>

        {/* Championship card */}
        <div
          className="absolute"
          style={{ left: CONNECTOR_W + 16, top: champY, width: FF_W - 32 }}
        >
          <MatchCard
            match={championship}
            onSelectTeam={onSelectTeam}
            width={FF_W - 32}
          />
        </div>
      </div>
    </div>
  );
};
