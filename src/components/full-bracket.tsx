"use client";
import { BracketState, Match, Team } from "@/lib/types";
import React, { useMemo, useRef, useState } from "react";
import {
  ActualResults,
  SimResults,
  SimScores,
  actualScores,
  applyResults,
  simulateResults,
} from "@/lib/simulate";
import { BracketScore, scoreBracket } from "@/lib/scoring";
import { BracketView } from "./bracket-view";

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
    actual?: boolean;
  } | null>(null);
  const [loadingActual, setLoadingActual] = useState(false);
  const [actualError, setActualError] = useState<string | null>(null);
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
          aria-pressed={results !== null && !results.actual}
          onClick={() => setResults(simulateResults(state))}
          className="rounded-full border-2 border-gray-300 bg-white px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-gray-700 shadow-sm transition-colors hover:bg-gray-100 aria-pressed:border-gray-800 aria-pressed:bg-gray-800 aria-pressed:text-white"
        >
          {results && !results.actual ? "Re-simulate" : "Simulate Results"}
        </button>
        <button
          type="button"
          aria-pressed={results?.actual === true}
          onClick={handleShowActual}
          disabled={loadingActual}
          className="rounded-full border-2 border-gray-300 bg-white px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60 aria-pressed:border-gray-800 aria-pressed:bg-gray-800 aria-pressed:text-white"
        >
          {loadingActual ? "Loading..." : "ESPN Results"}
        </button>
        <button
          type="button"
          onClick={() => {
            setResults(null);
            setActualError(null);
          }}
          disabled={results === null}
          className="rounded-full border-2 border-gray-300 bg-white px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
        >
          Reset Simulation
        </button>
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
          label={results?.actual ? "Actual score" : "Simulated score"}
        />
      )}
      {(resetError || saveError || actualError) && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {resetError ?? saveError ?? actualError}
        </p>
      )}
      <BracketView
        state={shown}
        onSelectTeam={handleSelectTeam}
        busy={saving}
      />
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
