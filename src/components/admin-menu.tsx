"use client";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { ROUND_POINTS } from "@/lib/scoring";
import {
  SimResults,
  SimScores,
  completedRounds,
  simulateResults,
} from "@/lib/simulate";
import { BracketState } from "@/lib/types";

// The tournament as saved: the bracket without picks, and its results.
type Tournament = {
  state: BracketState;
  results: SimResults;
  scores: SimScores;
};

const TournamentContext = createContext<Tournament | null>(null);

// Given only to the super admin, once the tournament is set up, so every
// page's header can show their simulation and reset menu.
export function AdminMenuProvider({
  tournament,
  children,
}: {
  tournament: Tournament | null;
  children: React.ReactNode;
}) {
  return (
    <TournamentContext.Provider value={tournament}>
      {children}
    </TournamentContext.Provider>
  );
}

// The super admin's simulation and reset options, behind an ellipsis. Shows
// nothing for anyone else. Saved results apply to everyone, so the page is
// refreshed to show them.
export function AdminMenu() {
  const tournament = useContext(TournamentContext);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [storing, setStoring] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!tournament) return null;
  const { state, results, scores } = tournament;
  const busy = storing || refreshing;
  // Rounds with every game decided; the next round is the latest one that can
  // be simulated.
  const roundsDone = completedRounds(state, results);

  async function storeResults(winners: SimResults | null, scores?: SimScores) {
    setStoring(true);
    setStatus(null);
    setError(null);
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
      setStatus(
        winners
          ? `Saved ${body.saved} winners for everyone`
          : "Cleared the scores and actual winners",
      );
      startRefresh(() => router.refresh());
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save the results",
      );
    } finally {
      setStoring(false);
    }
  }

  const menuLabel = "Simulation and reset options";
  return (
    <div className="flex items-center gap-3">
      {(busy || status || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`text-sm font-semibold ${error ? "text-red-700" : "text-gray-700"}`}
        >
          {busy ? "Saving tournament results..." : (error ?? status)}
        </p>
      )}
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
          {busy ? <ResetIcon spinning /> : <EllipsisIcon />}
        </button>
        {menuOpen && (
          // Choosing an option closes the menu.
          <div
            role="menu"
            onClick={() => setMenuOpen(false)}
            className="absolute right-0 top-full z-30 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-lg"
          >
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Simulate through
            </p>
            {ROUND_POINTS.map((round, index) => (
              // Keeps the saved results, plays this round and clears the
              // later rounds. A round can only be played once every game
              // before it has a result.
              <MenuItem
                key={round.name}
                disabled={busy || index > roundsDone}
                hint={
                  index > roundsDone
                    ? `Simulate the ${ROUND_POINTS[index - 1].name} first`
                    : index === 0
                      ? "Plays the First Four and Round of 64"
                      : `Keeps earlier results and plays through the ${round.name}`
                }
                onSelect={() => {
                  const simulated = simulateResults(state, index + 1, {
                    winners: results,
                    scores,
                  });
                  storeResults(simulated.winners, simulated.scores);
                }}
              >
                {round.name}
              </MenuItem>
            ))}
            <div className="my-1 border-t border-gray-100" />
            <MenuItem
              disabled={busy}
              hint="Clears the scores and actual winners; picks are kept"
              onSelect={() => storeResults(null)}
            >
              Reset Simulation
            </MenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onSelect,
  disabled = false,
  hint,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      title={hint}
      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left font-semibold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="w-4 shrink-0" aria-hidden />
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
