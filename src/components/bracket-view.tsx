"use client";
import {
  BRACKET_LINE_CLASS,
  BRACKET_LINE_COLOR,
  BracketState,
  DESKTOP_REGION_GAP,
  Match,
  Team,
} from "@/lib/types";
import React, { useLayoutEffect, useRef, useState } from "react";
import { RegionBracket } from "./region-bracket";
import { ChampionCard } from "./champion-card";
import { ChampionshipCard } from "./championship-card";
import { MatchCard } from "./match-card";
import { FinalFourCenter } from "./final-four-center";
import { RegionBracketMirrored } from "./region-bracket-mirrored";

// The Opening Round and the full bracket: stacked on mobile, scaled to fit the
// width with mirrored right regions on desktop.
export const BracketView = ({
  state,
  onSelectTeam,
  busy = false,
}: {
  state: BracketState;
  onSelectTeam: (match: Match, team: Team) => void;
  busy?: boolean;
}) => {
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
    // The viewport also changes width when the sidebar opens or closes.
    const observer = new ResizeObserver(updateScale);
    if (desktopViewportRef.current)
      observer.observe(desktopViewportRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return (
    <>
      {!!state.firstFour?.length && (
        <section
          aria-label="Opening Round"
          aria-busy={busy}
          className="mb-8 border-b border-gray-200 pb-6"
        >
          <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-widest">
            <span className="inline-block rounded-full bg-sideline-900/85 px-3 py-0.5 text-white shadow-sm">
              Opening Round
            </span>
          </h2>
          <fieldset
            disabled={busy}
            className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            {state.firstFour.map((match) => (
              <div key={match.id} className="min-w-0">
                <div className="mb-2 text-sm font-black uppercase tracking-widest">
                  <span className="inline-block rounded-full bg-sideline-900/85 px-3 leading-5 text-white shadow-sm">
                    {match.region}
                  </span>
                </div>
                <MatchCard
                  match={match}
                  onSelectTeam={onSelectTeam}
                  width="100%"
                />
              </div>
            ))}
          </fieldset>
        </section>
      )}
      {/* ── MOBILE: stacked regions, no mirroring ── */}
      <div className="flex flex-col gap-10 lg:hidden overflow-x-auto">
        <RegionBracket
          region={state.regions[0]}
          onSelectTeam={onSelectTeam}
        />
        <RegionBracket
          region={state.regions[1]}
          onSelectTeam={onSelectTeam}
        />
        <RegionBracket
          region={state.regions[2]}
          onSelectTeam={onSelectTeam}
        />
        <RegionBracket
          region={state.regions[3]}
          onSelectTeam={onSelectTeam}
        />

        {/* Final Four — simplified stacked layout at bottom on mobile */}
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <MatchCard
              match={state.ff[0]}
              onSelectTeam={onSelectTeam}
              width="100%"
            />
            <MatchCard
              match={state.ff[1]}
              onSelectTeam={onSelectTeam}
              width="100%"
            />
          </div>
          <div className="relative h-8 w-full" aria-hidden="true">
            <svg
              className={`absolute inset-0 h-full w-full ${BRACKET_LINE_CLASS}`}
              viewBox="0 0 100 32"
              preserveAspectRatio="none"
            >
              <path
                d="M 25 0 V 16 H 50 V 32 M 75 0 V 16 H 50"
                fill="none"
                stroke={BRACKET_LINE_COLOR}
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <ChampionshipCard
            match={state.championship}
            onSelectTeam={onSelectTeam}
            width="100%"
          />
          {state.championship.winner && (
            <ChampionCard team={state.championship.winner} width="100%" />
          )}
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
          className={`flex min-w-max items-start gap-0 p-8 ${desktopSize === null ? "" : "absolute left-1/2 top-0"}`}
          style={
            desktopSize === null
              ? undefined
              : {
                  transform: `scale(${desktopSize.scale}) translateX(-50%)`,
                  transformOrigin: "top left",
                }
          }
        >
          {/* LEFT SIDE: East (top) + South (bottom) */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: DESKTOP_REGION_GAP }}
          >
            <RegionBracket
              region={state.regions[0]}
              onSelectTeam={onSelectTeam}
            />
            <RegionBracket
              region={state.regions[1]}
              onSelectTeam={onSelectTeam}
              showRoundNames={false}
            />
          </div>

          {/* CENTER: Final Four */}
          <FinalFourCenter
            ff={state.ff}
            championship={state.championship}
            onSelectTeam={onSelectTeam}
          />

          {/* RIGHT SIDE: West (top) + Midwest (bottom) — mirrored */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: DESKTOP_REGION_GAP }}
          >
            <RegionBracketMirrored
              region={state.regions[2]}
              onSelectTeam={onSelectTeam}
            />
            <RegionBracketMirrored
              region={state.regions[3]}
              onSelectTeam={onSelectTeam}
              showRoundNames={false}
            />
          </div>
        </div>
      </div>
    </>
  );
};
