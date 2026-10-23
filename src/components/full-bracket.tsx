"use client";
import { CARD_W, Match, Team } from "@/lib/types";
import { buildInitialState } from "@/lib/utils";
import React, { useLayoutEffect, useRef, useState } from "react";
import { RegionBracket } from "./region-bracket";
import { ChampionCard } from "./champion-card";
import { MatchCard } from "./match-card";
import { FinalFourCenter } from "./final-four-center";
import { RegionBracketMirrored } from "./region-bracket-mirrored";

export const FullBracket = () => {
  const [state, setState] = useState(buildInitialState);
  const desktopViewportRef = useRef<HTMLDivElement>(null);
  const desktopContentRef = useRef<HTMLDivElement>(null);
  const [desktopSize, setDesktopSize] = useState<{
    scale: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const updateScale = () => {
      const viewport = desktopViewportRef.current;
      const content = desktopContentRef.current;
      if (!viewport || !content || window.innerWidth < 1024) return;

      const availableWidth = viewport.clientWidth;
      const scale = availableWidth / content.offsetWidth;
      setDesktopSize({ scale, height: content.offsetHeight });
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  function handleSelectTeam(match: Match, team: Team) {
    setState((prev) => {
      // Deep clone
      const next = {
        regions: prev.regions.map((r) => ({
          ...r,
          rounds: r.rounds.map((round) => ({
            ...round,
            matches: round.matches.map((m) => ({
              ...m,
              teams: [...m.teams] as [Team | null, Team | null],
            })),
          })),
        })),
        ff: prev.ff.map((m) => ({
          ...m,
          teams: [...m.teams] as [Team | null, Team | null],
        })),
        championship: {
          ...prev.championship,
          teams: [...prev.championship.teams] as [Team | null, Team | null],
        },
      };

      // Find the match — search regions first, then ff, then championship
      let found = false;

      // Check championship
      if (next.championship.id === match.id) {
        next.championship.winner = team;
        found = true;
      }

      // Check ff
      if (!found) {
        const fi = next.ff.findIndex((m) => m.id === match.id);
        if (fi !== -1) {
          next.ff[fi].winner = team;
          // Advance to championship
          const side = fi as 0 | 1;
          next.championship.teams[side] = team;
          next.championship.winner = null;
          next.championship.score = [null, null];
          found = true;
        }
      }

      // Check regions
      if (!found) {
        for (let regi = 0; regi < next.regions.length; regi++) {
          const region = next.regions[regi];
          let ri = -1,
            mi = -1;
          for (let r = 0; r < region.rounds.length; r++) {
            const m = region.rounds[r].matches.findIndex(
              (m) => m.id === match.id,
            );
            if (m !== -1) {
              ri = r;
              mi = m;
              break;
            }
          }
          if (ri === -1) continue;

          region.rounds[ri].matches[mi].winner = team;

          if (ri + 1 < region.rounds.length) {
            // Advance within region
            const slot = Math.floor(mi / 2);
            const side = (mi % 2) as 0 | 1;
            region.rounds[ri + 1].matches[slot].teams[side] = team;
            region.rounds[ri + 1].matches[slot].winner = null;
            region.rounds[ri + 1].matches[slot].score = [null, null];
            // Clear downstream
            for (let r = ri + 2; r < region.rounds.length; r++) {
              const s = Math.floor(slot / Math.pow(2, r - ri - 1));
              if (region.rounds[r]?.matches[s]) {
                region.rounds[r].matches[s].teams = [null, null];
                region.rounds[r].matches[s].winner = null;
                region.rounds[r].matches[s].score = [null, null];
              }
            }
          } else {
            // Elite 8 winner → Final Four
            // South(0) and West(1) → ff[0] top/bottom
            // East(2) and Midwest(3) → ff[1] top/bottom
            const ffIndex = regi < 2 ? 0 : 1;
            const ffSide = (regi % 2) as 0 | 1;
            next.ff[ffIndex].teams[ffSide] = team;
            next.ff[ffIndex].winner = null;
            next.ff[ffIndex].score = [null, null];
            next.championship.teams[ffIndex as 0 | 1] = null;
            next.championship.winner = null;
            next.championship.score = [null, null];
          }
          found = true;
          break;
        }
      }

      return next;
    });
  }

  return (
    <div className="w-full">
      {/* ── MOBILE: stacked regions, no mirroring ── */}
      <div className="flex flex-col gap-10 lg:hidden overflow-x-auto">
        <RegionBracket
          region={state.regions[0]}
          onSelectTeam={handleSelectTeam}
        />
        <RegionBracket
          region={state.regions[1]}
          onSelectTeam={handleSelectTeam}
        />
        <RegionBracket
          region={state.regions[2]}
          onSelectTeam={handleSelectTeam}
        />
        <RegionBracket
          region={state.regions[3]}
          onSelectTeam={handleSelectTeam}
        />

        {/* Final Four — simplified stacked layout at bottom on mobile */}
        <div className="flex flex-col gap-4">
          <div className="mb-1">
            <div className="text-xs font-black uppercase tracking-widest text-gray-500">
              Final Four
            </div>
            {state.championship.winner && (
              <ChampionCard team={state.championship.winner} width={CARD_W} />
            )}
          </div>
          <MatchCard
            match={state.ff[0]}
            onSelectTeam={handleSelectTeam}
            width={CARD_W}
          />
          <MatchCard
            match={state.ff[1]}
            onSelectTeam={handleSelectTeam}
            width={CARD_W}
          />
          <MatchCard
            match={state.championship}
            onSelectTeam={handleSelectTeam}
            width={CARD_W}
          />
        </div>
      </div>

      {/* ── DESKTOP: side-by-side with mirrored right regions ── */}
      <div
        ref={desktopViewportRef}
        className="relative hidden w-full overflow-x-hidden overflow-y-hidden lg:block"
        style={
          desktopSize === null
            ? undefined
            : {
                height: `${desktopSize.height * desktopSize.scale}px`,
              }
        }
      >
        <div
          ref={desktopContentRef}
          className={`flex min-w-max items-start gap-0 ${desktopSize === null ? "" : "absolute left-1/2 top-0"}`}
          style={
            desktopSize === null
              ? undefined
              : {
                  transform: `scale(${desktopSize.scale}) translateX(-50%)`,
                  transformOrigin: "top left",
                }
          }
        >
          {/* LEFT SIDE: South (top) + West (bottom) */}
          <div className="flex flex-col gap-8 shrink-0">
            <RegionBracket
              region={state.regions[0]}
              onSelectTeam={handleSelectTeam}
            />
            <RegionBracket
              region={state.regions[1]}
              onSelectTeam={handleSelectTeam}
            />
          </div>

          {/* CENTER: Final Four */}
          <FinalFourCenter
            ff={state.ff}
            championship={state.championship}
            onSelectTeam={handleSelectTeam}
          />

          {/* RIGHT SIDE: East (top) + Midwest (bottom) — mirrored */}
          <div className="flex flex-col gap-8 shrink-0">
            <RegionBracketMirrored
              region={state.regions[2]}
              onSelectTeam={handleSelectTeam}
            />
            <RegionBracketMirrored
              region={state.regions[3]}
              onSelectTeam={handleSelectTeam}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
