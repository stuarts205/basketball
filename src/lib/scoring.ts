import { BracketState, Match } from "./types";

// Points per correct pick, doubling each round (1-2-4-8-16-32), with no seed
// bonus. A round scores correct picks x its points; the total is the sum of
// all six rounds. First Four games are not scored.
export const ROUND_POINTS = [
  { name: "1st Round", points: 1 },
  { name: "2nd Round", points: 2 },
  { name: "Sweet 16", points: 4 },
  { name: "Elite 8", points: 8 },
  { name: "Final 4", points: 16 },
  { name: "Championship Game", points: 32 },
] as const;

export type RoundScore = {
  name: string;
  correct: number;
  games: number;
  points: number;
  maxPoints: number;
  // Points up for grabs in the games already played.
  playedPoints: number;
};

export type BracketScore = {
  rounds: RoundScore[];
  points: number;
  maxPoints: number;
  playedPoints: number;
};

// The share of the points played so far that the picks won, as a whole
// percent, or null before any game is played.
export function percentWon(score: {
  points: number;
  playedPoints: number;
}): number | null {
  if (!score.playedPoints) return null;
  return Math.round((score.points / score.playedPoints) * 100);
}

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
    const played = matches.filter((match) => match.actualWinner != null).length;
    return {
      name,
      correct,
      games: matches.length,
      points: correct * points,
      maxPoints: matches.length * points,
      playedPoints: played * points,
    };
  });
  return {
    rounds,
    points: rounds.reduce((sum, round) => sum + round.points, 0),
    maxPoints: rounds.reduce((sum, round) => sum + round.maxPoints, 0),
    playedPoints: rounds.reduce((sum, round) => sum + round.playedPoints, 0),
  };
}
