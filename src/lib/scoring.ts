import { BracketState, Match } from "./types";

// First Four games are not scored.
export const ROUND_POINTS = [
  { name: "Round of 64", points: 10 },
  { name: "Round of 32", points: 20 },
  { name: "Sweet 16", points: 40 },
  { name: "Elite 8", points: 80 },
  { name: "Final Four", points: 160 },
  { name: "Championship", points: 320 },
] as const;

export type RoundScore = {
  name: string;
  correct: number;
  games: number;
  points: number;
  maxPoints: number;
};

export type BracketScore = {
  rounds: RoundScore[];
  points: number;
  maxPoints: number;
};

function scoredMatchesByRound(state: BracketState): Match[][] {
  return [
    ...[0, 1, 2, 3].map((roundIndex) =>
      state.regions.flatMap((region) => region.rounds[roundIndex]?.matches ?? []),
    ),
    state.ff,
    [state.championship],
  ];
}

// Scores the user's picks against each game's actual winner.
export function scoreBracket(state: BracketState): BracketScore {
  const rounds = scoredMatchesByRound(state).map((matches, index) => {
    const { name, points } = ROUND_POINTS[index];
    const correct = matches.filter(
      (match) =>
        match.winner != null &&
        match.actualWinner != null &&
        match.winner.name === match.actualWinner.name,
    ).length;
    return {
      name,
      correct,
      games: matches.length,
      points: correct * points,
      maxPoints: matches.length * points,
    };
  });
  return {
    rounds,
    points: rounds.reduce((sum, round) => sum + round.points, 0),
    maxPoints: rounds.reduce((sum, round) => sum + round.maxPoints, 0),
  };
}
