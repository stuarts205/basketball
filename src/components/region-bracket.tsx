import { CARD_W, COL_LABEL_H, Match, Region, Team } from '@/lib/types';
import React from 'react'
import { ConnectorLines } from './connector-lines';
import { roundLayout } from '@/lib/utils';
import { MatchCard } from './match-card';

export const RegionBracket = ({
  region,
  onSelectTeam,
}: {
  region: Region;
  onSelectTeam: (match: Match, team: Team) => void;
}) => {
  return (
      <div className="flex flex-col items-start shrink-0">
        <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 pl-1">
          {region.name}
        </div>
        <div className="flex items-start">
          {region.rounds.map((round, ri) => (
            <div key={round.name} className="flex items-start shrink-0">
              {ri > 0 && <ConnectorLines roundIndex={ri} />}
              <div className="flex flex-col shrink-0">
                <div
                  className="text-[9px] font-bold text-gray-300 uppercase tracking-widest text-center"
                  style={{
                    width: CARD_W,
                    height: COL_LABEL_H,
                    lineHeight: `${COL_LABEL_H}px`,
                  }}
                >
                  {round.name}
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
}
