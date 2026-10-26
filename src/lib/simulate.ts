import { BracketState, Match, Team } from "./types";

// Simulated results: the winning team's name for each game id.
export type SimResults = Record<string, string>;

type Decide = (match: Match, actualTeams: [Team | null, Team | null]) => Team | null;

function withActual<M extends Match>(
  match: M,
  actualTeams: [Team | null, Team | null],
  decide: Decide,
): M {
  return { ...match, actualTeams, actualWinner: decide(match, actualTeams) };
}

// Walks the bracket along the real results, not the user's picks, so each
// game's actual teams come from the actual winners of its feeder games.
function walkActual(state: BracketState, decide: Decide): BracketState {
  const firstFour = state.firstFour?.map((match) =>
    withActual(match, match.teams, decide),
  );
  const regions = state.regions.map((region) => {
    const rounds: typeof region.rounds = [];
    region.rounds.forEach((round, roundIndex) => {
      const matches = round.matches.map((match, matchIndex) => {
        let actualTeams: [Team | null, Team | null];
        if (roundIndex === 0) {
          actualTeams = [...match.teams];
          // First Four slots hold the user's pick; swap in the real winner.
          for (const feeder of firstFour ?? []) {
            if (feeder.nextGameId === match.id) {
              actualTeams[feeder.nextSlot] = feeder.actualWinner ?? null;
            }
          }
        } else {
          const previous = rounds[roundIndex - 1].matches;
          actualTeams = [
            previous[matchIndex * 2]?.actualWinner ?? null,
            previous[matchIndex * 2 + 1]?.actualWinner ?? null,
          ];
        }
        return withActual(match, actualTeams, decide);
      });
      rounds.push({ ...round, matches });
    });
    return { ...region, rounds };
  });
  const ff = state.ff.map((match, index) =>
    withActual(
      match,
      [regions[index * 2], regions[index * 2 + 1]].map(
        (region) => region?.rounds[3]?.matches[0]?.actualWinner ?? null,
      ) as [Team | null, Team | null],
      decide,
    ),
  );
  const championship = withActual(
    state.championship,
    [ff[0]?.actualWinner ?? null, ff[1]?.actualWinner ?? null],
    decide,
  );
  return { ...state, firstFour, regions, ff, championship };
}

// Higher seeds usually win. This averages two curves: one by seed gap, which
// keeps 16-over-1 upsets rare, and one by seed ratio, which keeps 1-seeds the
// favorites against 4s and 2s in later rounds. Fitted loosely to tournament
// history: a 1 beats a 16 ~97% of the time, a 5 beats a 12 ~73%, a 1 beats a
// 4 ~72%, and 8 vs 9 is close to a toss-up. Equal seeds are a coin flip.
const EDGE_PER_SEED = 0.031;
const SEED_EXPONENT = 1.2;

export function topWinChance(top: Team, bottom: Team): number {
  if (!top.seed || !bottom.seed) return 0.5;
  const byGap = 0.5 + (bottom.seed - top.seed) * EDGE_PER_SEED;
  const ratio = (bottom.seed / top.seed) ** SEED_EXPONENT;
  const byRatio = ratio / (ratio + 1);
  return (byGap + byRatio) / 2;
}

// Simulated final scores by game id, in the same order as the game's actual teams.
export type SimScores = Record<string, [number, number]>;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// A plausible final score. Favorites that win tend to win by more.
function simulateScore(winner: Team, loser: Team): [number, number] {
  const winnerPoints = randomInt(62, 88);
  const seedGap = winner.seed && loser.seed ? loser.seed - winner.seed : 0;
  const margin = randomInt(1, 12) + Math.max(0, Math.round(seedGap * Math.random()));
  return [winnerPoints, Math.max(40, winnerPoints - margin)];
}

// Plays every game in the tournament, weighted by seed. Only first-round
// games get scores.
export function simulateResults(state: BracketState): {
  winners: SimResults;
  scores: SimScores;
} {
  const firstRound = new Set(
    state.regions.flatMap((region) =>
      (region.rounds[0]?.matches ?? []).map((match) => match.id),
    ),
  );
  const winners: SimResults = {};
  const scores: SimScores = {};
  walkActual(state, (match, [top, bottom]) => {
    if (!top || !bottom) return null;
    const topWins = Math.random() < topWinChance(top, bottom);
    const winner = topWins ? top : bottom;
    winners[match.id] = winner.name;
    if (firstRound.has(match.id)) {
      const [winnerPoints, loserPoints] = simulateScore(
        winner,
        topWins ? bottom : top,
      );
      scores[match.id] = topWins
        ? [winnerPoints, loserPoints]
        : [loserPoints, winnerPoints];
    }
    return winner;
  });
  return { winners, scores };
}

export function applyResults(
  state: BracketState,
  results: SimResults,
  scores?: SimScores,
): BracketState {
  const applied = walkActual(
    state,
    (match, actualTeams) =>
      actualTeams.find((team) => team?.name === results[match.id]) ?? null,
  );
  if (!scores) return applied;
  // A score shows only beside the team that actually played in that slot.
  const regions = applied.regions.map((region) => ({
    ...region,
    rounds: region.rounds.map((round, roundIndex) =>
      roundIndex !== 0
        ? round
        : {
            ...round,
            matches: round.matches.map((match) => {
              const score = scores[match.id];
              if (!score) return match;
              return {
                ...match,
                score: match.teams.map((team, i) =>
                  team && team.name === match.actualTeams?.[i]?.name
                    ? score[i]
                    : null,
                ) as [number | null, number | null],
              };
            }),
          },
    ),
  }));
  return { ...applied, regions };
}
