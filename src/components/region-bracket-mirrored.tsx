import {
  CARD_W,
  COL_LABEL_H,
  Match,
  Region,
  ROUND_INSETS,
  Team,
} from "@/lib/types";
import React from "react";
import { ConnectorLinesMirrored } from "./connector-lines-mirrored";
import { roundLayout } from "@/lib/utils";
import { MatchCard } from "./match-card";

export const RegionBracketMirrored = ({
  region,
  onSelectTeam,
}: {
  region: Region;
  onSelectTeam: (match: Match, team: Team) => void;
}) => {
  return (
    <div className="isolate flex flex-col items-end shrink-0">
      <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 pr-1">
        {region.name}
      </div>
      <div className="flex flex-row-reverse items-start">
        {region.rounds.map((round, ri) => (
          <div
            key={round.name}
            className="flex flex-row-reverse items-start shrink-0"
            style={{ marginRight: -(ROUND_INSETS[ri] ?? 0) }}
          >
            {ri > 0 && <ConnectorLinesMirrored roundIndex={ri} />}
            <div className="pointer-events-none relative z-10 flex flex-col shrink-0">
              <div
                className="text-[10px] font-extrabold uppercase tracking-widest text-center"
                style={{
                  width: CARD_W,
                  height: COL_LABEL_H,
                  lineHeight: `${COL_LABEL_H}px`,
                  ...(ri >= 2
                    ? {
                        transform: `translateY(${roundLayout(ri).topPad}px)`,
                        textAlign: "left",
                        paddingLeft: 4,
                      }
                    : {}),
                }}
              >
                <span className="inline-block rounded-full bg-sideline-900/85 px-2.5 align-middle leading-[18px] text-white shadow-sm">
                  {round.name}
                </span>
              </div>
              <div
                className="flex flex-col shrink-0"
                style={{
                  paddingTop: roundLayout(ri).topPad,
                  gap: roundLayout(ri).gap,
                }}
              >
                {round.matches.map((m) => (
                  <MatchCard key={m.id} match={m} onSelectTeam={onSelectTeam} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
