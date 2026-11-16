"use client";
import { BracketState, Match, Team } from "@/lib/types";
import React, { useMemo, useRef, useState } from "react";
import {
  SimResults,
  SimScores,
  applyResults,
  resultsAsBracket,
} from "@/lib/simulate";
import {
  BracketScore,
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
  // The saved results drawn over the picks, or null when no game has a
  // result yet. Saving results refreshes the page, which updates them.
  const results = useMemo(
    () =>
      Object.keys(savedResults).length > 0
        ? { winners: savedResults, scores: savedScores }
        : null,
    [savedResults, savedScores],
  );
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRef = useRef(false);

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

  return (
    <div className="w-full">
      <PageHeader title={title} subtitle={subtitle} />
      {score && (
        <ScoreSummary score={score} label={readOnly ? "Score" : "Your score"} />
      )}
      {saveError && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {saveError}
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
