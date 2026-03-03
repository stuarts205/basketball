import { CARD_H, COL_LABEL_H, CONNECTOR_W, Match, Team } from '@/lib/types';
import { roundLayout } from '@/lib/utils';
import React from 'react'
import { MatchCard } from './match-card';

export const FinalFourCenter = ({
  ff,
  championship,
  onSelectTeam,
}: {
  ff: Match[];
  championship: Match;
  onSelectTeam: (match: Match, team: Team) => void;
}) => {
  // Compute total height of a region so we can center the FF vertically
    const { topPad: tp0, gap: g0 } = roundLayout(0);
    const regionH = COL_LABEL_H + tp0 + 8 * CARD_H + 7 * g0;
  
    // Two regions stacked (South + West on left = total height)
    const totalH = regionH * 2 + 32; // 32 = gap between South and West regions
  
    // Final Four: two semifinal cards + championship in center
    // Position semifinal 0 at ~1/4 height, semifinal 1 at ~3/4 height
    const semi0Y = totalH / 4 - CARD_H / 2;
    const semi1Y = (3 * totalH) / 4 - CARD_H / 2;
    const champY = totalH / 2 - CARD_H / 2;
  
    const FF_W = 200;
    const COL_W = FF_W + CONNECTOR_W * 2 + 32;
  
    return (
      <div
        className="shrink-0 flex flex-col items-center"
        style={{ width: COL_W }}
      >
        {/* Header */}
        <div
          className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center"
          style={{ height: COL_LABEL_H, lineHeight: `${COL_LABEL_H}px` }}
        >
          Final Four
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
              d={`M 0 ${semi0Y + CARD_H / 2} H ${CONNECTOR_W}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
            {/* Line from left E8 (right edge) to FF semi 1 */}
            <path
              d={`M 0 ${semi1Y + CARD_H / 2} H ${CONNECTOR_W}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
            {/* Vertical bar connecting semi0 and semi1 on left */}
            <path
              d={`M ${CONNECTOR_W} ${semi0Y + CARD_H / 2} V ${semi1Y + CARD_H / 2}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
            {/* Line from midpoint of semis to championship */}
            <path
              d={`M ${CONNECTOR_W} ${champY + CARD_H / 2} H ${CONNECTOR_W + 16}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
  
            {/* Right connector: right E8 → FF */}
            <path
              d={`M ${COL_W} ${semi0Y + CARD_H / 2} H ${COL_W - CONNECTOR_W}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
            <path
              d={`M ${COL_W} ${semi1Y + CARD_H / 2} H ${COL_W - CONNECTOR_W}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
            <path
              d={`M ${COL_W - CONNECTOR_W} ${semi0Y + CARD_H / 2} V ${semi1Y + CARD_H / 2}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
            <path
              d={`M ${COL_W - CONNECTOR_W} ${champY + CARD_H / 2} H ${COL_W - CONNECTOR_W - 16}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
          </svg>
  
          {/* Left semifinal card */}
          <div
            className="absolute"
            style={{ left: CONNECTOR_W, top: semi0Y, width: FF_W }}
          >
            <div className="text-[9px] text-gray-300 font-bold uppercase tracking-wider text-center mb-0.5">
              Semifinal
            </div>
            <MatchCard match={ff[0]} onSelectTeam={onSelectTeam} width={FF_W} />
          </div>
  
          {/* Right semifinal card */}
          <div
            className="absolute"
            style={{ left: CONNECTOR_W, top: semi1Y, width: FF_W }}
          >
            <div className="text-[9px] text-gray-300 font-bold uppercase tracking-wider text-center mb-0.5">
              Semifinal
            </div>
            <MatchCard match={ff[1]} onSelectTeam={onSelectTeam} width={FF_W} />
          </div>
  
          {/* Championship card */}
          <div
            className="absolute"
            style={{ left: CONNECTOR_W + 16, top: champY, width: FF_W - 32 }}
          >
            <div className="text-[9px] text-blue-400 font-black uppercase tracking-wider text-center mb-0.5">
              Championship
            </div>
            <MatchCard
              match={championship}
              onSelectTeam={onSelectTeam}
              width={FF_W - 32}
            />
          </div>
        </div>
      </div>
    );
}
