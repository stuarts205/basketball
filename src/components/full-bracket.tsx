"use client";
import { BracketState, DESKTOP_REGION_GAP, Match, Team } from "@/lib/types";
import React, { useLayoutEffect, useRef, useState } from "react";
import { RegionBracket } from "./region-bracket";
import { ChampionCard } from "./champion-card";
import { MatchCard } from "./match-card";
import { FinalFourCenter } from "./final-four-center";
import { RegionBracketMirrored } from "./region-bracket-mirrored";

export const FullBracket = ({
  initialState,
  groupId,
}: {
  initialState: BracketState;
  // The group whose bracket is shown; picks are saved only with one.
  groupId: string | null;
}) => {
  const canEdit = groupId !== null;
  const [state, setState] = useState(initialState);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resetRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRef = useRef(false);
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

  async function handleResetPicks() {
    if (!groupId) return;
    if (resetRef.current || saveRef.current) return;
    resetRef.current = true;
    setResetting(true);
    setResetError(null);
    try {
      const response = await fetch(
        `/api/games/winner?groupId=${encodeURIComponent(groupId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not reset picks");
      }
      const { state: cleanState }: { state: BracketState } =
        await response.json();
      setState(cleanState);
      setSaveError(null);
    } catch (error) {
      setResetError(
        error instanceof Error ? error.message : "Could not reset picks",
      );
    } finally {
      resetRef.current = false;
      setResetting(false);
    }
  }

  async function handleSelectTeam(match: Match, team: Team) {
    if (!groupId) {
      setSaveError("Join a group to save your picks.");
      return;
    }
    if (resetRef.current) return;
    if (match.winner?.name === team.name) return;
    if (saveRef.current) return;
    saveRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/games/winner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          gameId: match.id,
          teamName: team.name,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not save this pick");
      }
      const { state: savedState }: { state: BracketState } =
        await response.json();
      setState(savedState);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save this pick",
      );
      return;
    } finally {
      saveRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={handleResetPicks}
          disabled={!canEdit || resetting || saving}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
        >
          {resetting ? "Resetting..." : "Reset Picks"}
        </button>
      </div>
      {(resetError || saveError) && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {resetError ?? saveError}
        </p>
      )}
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
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
          <div className="mb-1">
            <div className="text-xs font-black uppercase tracking-widest text-gray-500">
              Final Four
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MatchCard
              match={state.ff[0]}
              onSelectTeam={handleSelectTeam}
              width="100%"
            />
            <MatchCard
              match={state.ff[1]}
              onSelectTeam={handleSelectTeam}
              width="100%"
            />
          </div>
          <div className="relative h-8 w-full" aria-hidden="true">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 32"
              preserveAspectRatio="none"
            >
              <path
                d="M 25 0 V 16 H 50 V 32 M 75 0 V 16 H 50"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="w-full">
            <MatchCard
              match={state.championship}
              onSelectTeam={handleSelectTeam}
              width="100%"
            />
          </div>
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
          {/* LEFT SIDE: East (top) + South (bottom) */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: DESKTOP_REGION_GAP }}
          >
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

          {/* RIGHT SIDE: West (top) + Midwest (bottom) — mirrored */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: DESKTOP_REGION_GAP }}
          >
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
      {!!state.firstFour?.length && (
        <section
          aria-label="First Four"
          aria-busy={saving}
          className="mt-12 border-t border-gray-200 pt-6"
        >
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-600">
            First Four
          </h2>
          <fieldset
            disabled={saving}
            className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            {state.firstFour.map((match) => (
              <div key={match.id} className="min-w-0">
                <div className="mb-2 text-xs font-bold text-gray-500">
                  {match.region}
                </div>
                <MatchCard
                  match={match}
                  onSelectTeam={handleSelectTeam}
                  width="100%"
                />
              </div>
            ))}
          </fieldset>
        </section>
      )}
    </div>
  );
};
