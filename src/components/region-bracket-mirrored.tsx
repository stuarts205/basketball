import {
  CARD_W,
  COL_LABEL_H,
  Match,
  Region,
  ROUND_INSETS,
  REGION_NAME_GAP,
  ROUND_NAMES_GAP,
  Team,
} from "@/lib/types";
import React from "react";
import { ConnectorLinesMirrored } from "./connector-lines-mirrored";
import { roundLayout } from "@/lib/utils";
import { MatchCard } from "./match-card";

export const RegionBracketMirrored = ({
  region,
  onSelectTeam,
  showRoundNames = true,
}: {
  region: Region;
  onSelectTeam: (match: Match, team: Team) => void;
  // Off for a region drawn under another, whose names already label the columns.
  showRoundNames?: boolean;
}) => {
  return (
    <div className="isolate flex flex-col items-end shrink-0">
      {/* Round names on top, then the region name just above the games. Each
          row is 24px tall with ROUND_NAMES_GAP between them: FinalFourCenter
          lines up with the regions assuming that. The columns overlap, so the round names are spread across the
          region rather than set over each column. */}
      <div
        className="flex h-6 items-center justify-between self-stretch flex-row-reverse px-1 text-[10px] font-extrabold uppercase tracking-widest"
        style={{ marginBottom: ROUND_NAMES_GAP }}
      >
        {showRoundNames &&
          region.rounds.map((round) => (
            <span
              key={round.name}
              className="rounded-full bg-sideline-900/85 px-2.5 leading-[18px] text-white shadow-sm"
            >
              {round.name}
            </span>
          ))}
      </div>
      <div className="relative flex flex-row-reverse items-start">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-end pr-1 text-sm font-black uppercase tracking-widest"
          style={{ height: COL_LABEL_H - REGION_NAME_GAP }}
        >
          <span className="rounded-full bg-sideline-900/85 px-3 leading-5 text-white shadow-sm">
            {region.name}
          </span>
        </div>
        {region.rounds.map((round, ri) => (
          <div
            key={round.name}
            className="flex flex-row-reverse items-start shrink-0"
            style={{ marginRight: -(ROUND_INSETS[ri] ?? 0) }}
          >
            {ri > 0 && <ConnectorLinesMirrored roundIndex={ri} />}
            <div className="pointer-events-none relative z-10 flex flex-col shrink-0">
              <div style={{ width: CARD_W, height: COL_LABEL_H }} />
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
