"use client";
import { BracketState, DESKTOP_REGION_GAP, Match, Team } from "@/lib/types";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  SimResults,
  SimScores,
  applyResults,
  simulateResults,
} from "@/lib/simulate";
import { BracketScore, scoreBracket } from "@/lib/scoring";
import { RegionBracket } from "./region-bracket";
import { ChampionCard } from "./champion-card";
import { MatchCard } from "./match-card";
import { FinalFourCenter } from "./final-four-center";
import { RegionBracketMirrored } from "./region-bracket-mirrored";

export const FullBracket = ({
  initialState,
  groupId,
  groupName,
}: {
  initialState: BracketState;
  // The group whose bracket is shown; picks are saved only with one.
  groupId: string | null;
  groupName: string | null;
}) => {
  const canEdit = groupId !== null;
  const [state, setState] = useState(initialState);
  // A server refresh (e.g. after copying picks in) replaces local state.
  const [syncedInitialState, setSyncedInitialState] = useState(initialState);
  if (initialState !== syncedInitialState) {
    setSyncedInitialState(initialState);
    setState(initialState);
  }
  // Results shown over the picks; they live only in the browser, nothing is saved.
  const [results, setResults] = useState<{
    winners: SimResults;
    scores?: SimScores;
  } | null>(null);
  const shown = useMemo(
    () =>
      results ? applyResults(state, results.winners, results.scores) : state,
    [state, results],
  );
  const score = useMemo(
    () => (results ? scoreBracket(shown) : null),
    [shown, results],
  );
  const [confirmingReset, setConfirmingReset] = useState(false);
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
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          aria-pressed={results !== null}
          onClick={() => setResults(simulateResults(state))}
          className="rounded-full border-2 border-gray-300 bg-white px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-gray-700 shadow-sm transition-colors hover:bg-gray-100 aria-pressed:border-gray-800 aria-pressed:bg-gray-800 aria-pressed:text-white"
        >
          {results ? "Re-simulate" : "Simulate Results"}
        </button>
        {results && (
          <button
            type="button"
            onClick={() => setResults(null)}
            className="rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-gray-500 hover:bg-gray-100"
          >
            Hide Results
          </button>
        )}
        {/* Reset wipes the whole bracket, so it takes a second click to confirm. */}
        {confirmingReset ? (
          <div
            role="group"
            aria-label="Confirm reset"
            className="flex items-center gap-2 rounded-full border border-red-200 bg-white py-1 pl-4 pr-1 text-sm shadow-sm"
          >
            <span className="text-gray-800">
              Clear your picks for{" "}
              <span className="font-semibold">{groupName ?? "this group"}</span>
              ? Other groups won&apos;t change.
            </span>
            <button
              type="button"
              onClick={() => {
                setConfirmingReset(false);
                handleResetPicks();
              }}
              className="rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
            >
              Yes, reset
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => setConfirmingReset(false)}
              className="rounded-full px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            disabled={!canEdit || resetting || saving}
            title={canEdit ? undefined : "Join a group to make picks"}
            className="group flex items-center gap-2 rounded-full border-2 border-ball-500 bg-white px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-ball-600 shadow-sm transition-colors hover:bg-ball-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-ball-600"
          >
            <ResetIcon spinning={resetting} />
            {resetting ? "Resetting..." : "Reset Picks"}
          </button>
        )}
      </div>
      {score && (
        <ScoreSummary
          score={score}
          label="Simulated score"
        />
      )}
      {(resetError || saveError) && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {resetError ?? saveError}
        </p>
      )}
      {!!shown.firstFour?.length && (
        <section
          aria-label="First Four"
          aria-busy={saving}
          className="mb-8 border-b border-gray-200 pb-6"
        >
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-600">
            First Four
          </h2>
          <fieldset
            disabled={saving}
            className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            {shown.firstFour.map((match) => (
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
      {/* ── MOBILE: stacked regions, no mirroring ── */}
      <div className="flex flex-col gap-10 lg:hidden overflow-x-auto">
        <RegionBracket
          region={shown.regions[0]}
          onSelectTeam={handleSelectTeam}
        />
        <RegionBracket
          region={shown.regions[1]}
          onSelectTeam={handleSelectTeam}
        />
        <RegionBracket
          region={shown.regions[2]}
          onSelectTeam={handleSelectTeam}
        />
        <RegionBracket
          region={shown.regions[3]}
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
              match={shown.ff[0]}
              onSelectTeam={handleSelectTeam}
              width="100%"
            />
            <MatchCard
              match={shown.ff[1]}
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
                stroke="#b8a48a"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="w-full">
            <MatchCard
              match={shown.championship}
              onSelectTeam={handleSelectTeam}
              width="100%"
            />
          </div>
          {shown.championship.winner && (
            <ChampionCard team={shown.championship.winner} width="100%" />
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
              region={shown.regions[0]}
              onSelectTeam={handleSelectTeam}
            />
            <RegionBracket
              region={shown.regions[1]}
              onSelectTeam={handleSelectTeam}
            />
          </div>

          {/* CENTER: Final Four */}
          <FinalFourCenter
            ff={shown.ff}
            championship={shown.championship}
            onSelectTeam={handleSelectTeam}
          />

          {/* RIGHT SIDE: West (top) + Midwest (bottom) — mirrored */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: DESKTOP_REGION_GAP }}
          >
            <RegionBracketMirrored
              region={shown.regions[2]}
              onSelectTeam={handleSelectTeam}
            />
            <RegionBracketMirrored
              region={shown.regions[3]}
              onSelectTeam={handleSelectTeam}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function ScoreSummary({
  score,
  label,
}: {
  score: BracketScore;
  label: string;
}) {
  return (
    <section
      aria-label={label}
      className="mb-6 rounded-lg bg-white p-4 shadow-md"
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
          {label}
        </span>
        <span className="text-2xl font-black tabular-nums text-gray-900">
          {score.points}
        </span>
        <span className="text-sm tabular-nums text-gray-400">
          / {score.maxPoints} pts
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {score.rounds.map((round) => (
          <div key={round.name} className="min-w-0">
            <dt className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {round.name}
            </dt>
            <dd className="tabular-nums">
              <span className="font-bold text-gray-900">{round.points}</span>
              <span className="text-xs text-gray-400">
                {" "}
                pts · {round.correct}/{round.games} correct
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ResetIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 transition-transform ${spinning ? "animate-spin" : "group-hover:-rotate-90"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
