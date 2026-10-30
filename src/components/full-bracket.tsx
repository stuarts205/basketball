"use client";
import { BracketState, Match, Team } from "@/lib/types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActualResults,
  SimResults,
  SimScores,
  actualScores,
  applyResults,
  completedRounds,
  resultsAsBracket,
  simulateResults,
} from "@/lib/simulate";
import {
  BracketScore,
  ROUND_POINTS,
  percentWon,
  scoreBracket,
} from "@/lib/scoring";
import { BracketView } from "./bracket-view";
import { PageHeader } from "./page-header";

export const FullBracket = ({
  initialState,
  groupId,
  bracketNumber,
  isSuperAdmin,
  readOnly = false,
  title,
  subtitle,
  savedResults,
  savedScores,
}: {
  initialState: BracketState;
  // The group whose bracket is shown; picks are saved only with one.
  groupId: string | null;
  // Which of the user's brackets in the group this is.
  bracketNumber: number;
  // The super admin's simulations are saved as the tournament's results.
  isSuperAdmin: boolean;
  // Someone else's bracket, opened from the leaderboard: shown but not picked.
  readOnly?: boolean;
  // The page's title row, drawn here so the bracket's buttons share it.
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  // The saved actual winners, shown over the picks when the page opens.
  savedResults: SimResults;
  // The saved final scores of those games.
  savedScores: SimScores;
}) => {
  const [state, setState] = useState(initialState);
  // A server refresh (e.g. after copying or resetting picks) replaces local
  // state.
  const [syncedInitialState, setSyncedInitialState] = useState(initialState);
  if (initialState !== syncedInitialState) {
    setSyncedInitialState(initialState);
    setState(initialState);
  }
  // Results shown over the picks. They live only in the browser, except that
  // the super admin's simulated or ESPN results are also saved as every game's
  // actual winner.
  // The saved results, or null when no game has a result yet.
  const saved =
    Object.keys(savedResults).length > 0
      ? { winners: savedResults, scores: savedScores, saved: true }
      : null;
  const [results, setResults] = useState<{
    winners: SimResults;
    scores?: SimScores;
    // ESPN's results, fetched live.
    actual?: boolean;
    // The saved results from the database.
    saved?: boolean;
  } | null>(saved);
  const simulated = results !== null && !results.actual && !results.saved;
  const [loadingActual, setLoadingActual] = useState(false);
  const [actualError, setActualError] = useState<string | null>(null);
  // Saving or clearing the stored results (super admin only).
  const [storing, setStoring] = useState(false);
  const [storeStatus, setStoreStatus] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  async function storeResults(winners: SimResults | null, scores?: SimScores) {
    if (!isSuperAdmin) return;
    setStoring(true);
    setStoreStatus(null);
    setStoreError(null);
    try {
      const response = await fetch(
        "/api/games/results",
        winners
          ? {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ winners, scores }),
            }
          : { method: "DELETE" },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Could not save the results");
      setStoreStatus(
        winners
          ? `Saved ${body.saved} winners as the tournament results for everyone.`
          : "Cleared the scores and actual winners.",
      );
    } catch (error) {
      setStoreError(
        error instanceof Error ? error.message : "Could not save the results",
      );
    } finally {
      setStoring(false);
    }
  }
  // The super admin makes no picks, so they see the results themselves.
  const shown = useMemo(
    () =>
      !results
        ? state
        : isSuperAdmin
          ? resultsAsBracket(state, results.winners, results.scores)
          : applyResults(state, results.winners, results.scores),
    [state, results, isSuperAdmin],
  );
  const score = useMemo(
    () => (results && !isSuperAdmin ? scoreBracket(shown) : null),
    [shown, results, isSuperAdmin],
  );
  // The super admin's simulation and reset options live in a menu behind an
  // ellipsis. Players reset a bracket's picks from the sidebar.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRef = useRef(false);

  async function handleShowActual() {
    if (loadingActual) return;
    setLoadingActual(true);
    setActualError(null);
    try {
      const response = await fetch("/api/results");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load results");
      const actual: ActualResults = body;
      setResults({
        winners: actual.winners,
        scores: actualScores(state, actual),
        actual: true,
      });
      // For now the super admin's ESPN results are also saved as every game's
      // actual winner, which all users' picks are scored against. Later the
      // results will be kept up to date automatically during the tournament.
      storeResults(actual.winners, actualScores(state, actual));
    } catch (error) {
      setActualError(
        error instanceof Error ? error.message : "Could not load results",
      );
    } finally {
      setLoadingActual(false);
    }
  }

  async function handleSelectTeam(match: Match, team: Team) {
    if (!groupId) {
      setSaveError("Join a group to save your picks.");
      return;
    }
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
          bracket: bracketNumber,
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

  // Rounds with every game decided; the next round is the latest one that can
  // be simulated.
  const roundsDone = results ? completedRounds(state, results.winners) : 0;

  // Spins the menu button while results are loading or saving.
  const busyLabel = storing || loadingActual;
  const menuLabel = "Simulation and reset options";

  return (
    <div className="w-full">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          isSuperAdmin && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={menuLabel}
                title={menuLabel}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-100 aria-expanded:border-gray-800 aria-expanded:bg-gray-800 aria-expanded:text-white"
              >
                {busyLabel ? <ResetIcon spinning /> : <EllipsisIcon />}
              </button>
              {menuOpen && (
                // Choosing an option closes the menu.
                <div
                  role="menu"
                  onClick={() => setMenuOpen(false)}
                  className="absolute right-0 top-full z-30 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-lg"
                >
                  <MenuItem
                    checked={simulated}
                    disabled={storing}
                    onSelect={() => {
                      const simulated = simulateResults(state);
                      setResults(simulated);
                      storeResults(simulated.winners, simulated.scores);
                    }}
                  >
                    {simulated ? "Re-simulate" : "Simulate Results"}
                  </MenuItem>
                  <div className="my-1 border-t border-gray-100" />
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Simulate through
                  </p>
                  {ROUND_POINTS.map((round, index) => (
                    // Keeps the results already shown, plays this round and
                    // clears the later rounds. A round can only be played
                    // once every game before it has a result.
                    <MenuItem
                      key={round.name}
                      disabled={storing || index > roundsDone}
                      hint={
                        index > roundsDone
                          ? `Simulate the ${ROUND_POINTS[index - 1].name} first`
                          : index === 0
                            ? "Plays the First Four and Round of 64"
                            : `Keeps earlier results and plays through the ${round.name}`
                      }
                      onSelect={() => {
                        const simulated = simulateResults(
                          state,
                          index + 1,
                          results ?? undefined,
                        );
                        setResults(simulated);
                        storeResults(simulated.winners, simulated.scores);
                      }}
                    >
                      {round.name}
                    </MenuItem>
                  ))}
                  <div className="my-1 border-t border-gray-100" />
                  <MenuItem
                    checked={results?.actual === true}
                    disabled={loadingActual}
                    onSelect={handleShowActual}
                  >
                    {loadingActual ? "Loading..." : "ESPN Results"}
                  </MenuItem>
                  <MenuItem
                    disabled={storing}
                    hint="Clears the scores and actual winners; picks are kept"
                    onSelect={() => {
                      setResults(null);
                      setActualError(null);
                      storeResults(null);
                    }}
                  >
                    Reset Simulation
                  </MenuItem>
                </div>
              )}
            </div>
          )
        }
      />
      {score && (
        <ScoreSummary
          score={score}
          label={
            results?.saved
              ? readOnly
                ? "Score"
                : "Your score"
              : results?.actual
                ? "Actual score"
                : "Simulated score"
          }
        />
      )}
      {(saveError || actualError || storeError) && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {saveError ?? actualError ?? storeError}
        </p>
      )}
      {(storing || storeStatus) && (
        <p role="status" className="mb-4 text-sm font-semibold text-gray-700">
          {storing ? "Saving tournament results..." : storeStatus}
        </p>
      )}
      {isSuperAdmin || readOnly ? (
        // Nothing to pick: the bracket is for viewing results.
        <fieldset disabled className="min-w-0 [&_button]:pointer-events-none">
          <BracketView state={shown} onSelectTeam={() => {}} />
        </fieldset>
      ) : (
        <BracketView
          state={shown}
          onSelectTeam={handleSelectTeam}
          busy={saving}
        />
      )}
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
  const percent = percentWon(score);
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
        {percent !== null && (
          <span className="text-sm font-semibold tabular-nums text-gray-500">
            · {percent}% of {score.playedPoints} points so far
          </span>
        )}
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

function MenuItem({
  children,
  onSelect,
  disabled = false,
  checked,
  danger = false,
  hint,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  // For options that show results: whether those results are showing.
  checked?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      onClick={onSelect}
      disabled={disabled}
      title={hint}
      className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "text-red-600 hover:bg-red-50" : "text-gray-800 hover:bg-gray-100"} disabled:hover:bg-transparent`}
    >
      <span className="w-4 shrink-0 text-ball-600" aria-hidden>
        {checked ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}

function EllipsisIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
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
