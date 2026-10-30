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
          // Opening Round slots hold the user's pick; swap in the real winner.
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

// The ids of the games played through the given round, counting the Round of
// 64 as round 1. The Opening Round comes before it, so it's always included;
// rounds 5 and 6 are the Final Four and the championship.
function gamesThroughRound(state: BracketState, throughRound: number) {
  const ids = new Set(state.firstFour?.map((match) => match.id));
  for (const region of state.regions) {
    region.rounds
      .slice(0, throughRound)
      .forEach((round) => round.matches.forEach((match) => ids.add(match.id)));
  }
  if (throughRound >= 5) state.ff.forEach((match) => ids.add(match.id));
  if (throughRound >= 6) ids.add(state.championship.id);
  return ids;
}

// How many rounds have a winner in every game, counting as in
// `gamesThroughRound`: 0 before the Opening Round and Round of 64 are done, 6
// once the championship is.
export function completedRounds(state: BracketState, winners: SimResults) {
  let completed = 0;
  while (
    completed < 6 &&
    [...gamesThroughRound(state, completed + 1)].every((id) => id in winners)
  ) {
    completed++;
  }
  return completed;
}

// Plays the tournament, weighted by seed, with a final score. With
// `throughRound`, games after that round are left unplayed. Games in `kept`
// keep their result, so a round can be played on top of the earlier ones.
export function simulateResults(
  state: BracketState,
  throughRound?: number,
  kept?: { winners: SimResults; scores?: SimScores },
): {
  winners: SimResults;
  scores: SimScores;
} {
  const winners: SimResults = {};
  const scores: SimScores = {};
  const played =
    throughRound === undefined ? null : gamesThroughRound(state, throughRound);
  walkActual(state, (match, [top, bottom]) => {
    if (!top || !bottom) return null;
    if (played && !played.has(match.id)) return null;
    const keptWinner = [top, bottom].find(
      (team) => team.name === kept?.winners[match.id],
    );
    if (keptWinner) {
      winners[match.id] = keptWinner.name;
      const keptScore = kept?.scores?.[match.id];
      if (keptScore) scores[match.id] = keptScore;
      return keptWinner;
    }
    const topWins = Math.random() < topWinChance(top, bottom);
    const winner = topWins ? top : bottom;
    winners[match.id] = winner.name;
    const [winnerPoints, loserPoints] = simulateScore(
      winner,
      topWins ? bottom : top,
    );
    scores[match.id] = topWins
      ? [winnerPoints, loserPoints]
      : [loserPoints, winnerPoints];
    return winner;
  });
  return { winners, scores };
}

// Applies `update` to every game in the bracket.
function mapMatches(
  state: BracketState,
  update: <M extends Match>(match: M) => M,
): BracketState {
  return {
    ...state,
    firstFour: state.firstFour?.map(update),
    regions: state.regions.map((region) => ({
      ...region,
      rounds: region.rounds.map((round) => ({
        ...round,
        matches: round.matches.map(update),
      })),
    })),
    ff: state.ff.map(update),
    championship: update(state.championship),
  };
}

// Real results: winners by game id, and each team's points by game id and name.
export type ActualResults = {
  winners: SimResults;
  points: Record<string, Record<string, number>>;
};

// Puts real scores in the order of each game's actual teams.
export function actualScores(
  state: BracketState,
  results: ActualResults,
): SimScores {
  const scores: SimScores = {};
  mapMatches(applyResults(state, results.winners), (match) => {
    const points = results.points[match.id];
    const [top, bottom] = match.actualTeams ?? [];
    if (points && top && bottom && top.name in points && bottom.name in points) {
      scores[match.id] = [points[top.name], points[bottom.name]];
    }
    return match;
  });
  return scores;
}

// Draws the results themselves as the bracket, with no picks: each game shows
// the teams that actually played, the actual winner and the score. For viewers
// who don't make picks, like the super admin.
export function resultsAsBracket(
  state: BracketState,
  results: SimResults,
  scores?: SimScores,
): BracketState {
  return mapMatches(applyResults(state, results), (match) => {
    const teams = match.actualTeams ?? match.teams;
    return {
      ...match,
      teams,
      pendingTeams: undefined,
      winner: match.actualWinner ?? null,
      actualTeams: undefined,
      actualWinner: undefined,
      score: teams.map((team, i) =>
        team ? (scores?.[match.id]?.[i] ?? null) : null,
      ) as [number | null, number | null],
    };
  });
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
  // Scores belong to the teams that actually played; the card shows them in
  // place of a knocked-out pick.
  return mapMatches(applied, (match) => {
    const score = scores[match.id];
    if (!score) return match;
    return {
      ...match,
      score: match.teams.map((team, i) =>
        team && match.actualTeams?.[i] ? score[i] : null,
      ) as [number | null, number | null],
    };
  });
}
