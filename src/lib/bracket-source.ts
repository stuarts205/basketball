// The shape of the tournament bracket data saved in data/tournament-<year>.json.
export type Competitor = {
  id: string;
  name: string;
  location: string;
  abbreviation: string;
  color: string;
  alternateColor: string;
  logo: string;
  seed: string;
  winner: boolean;
};
export type Matchup = {
  id: string;
  roundId: number;
  bracketLocation: number;
  regionId?: number;
  statusState: string;
  competitorOne: Competitor;
  competitorTwo: Competitor;
};
export type Tournament = {
  season: number | string;
  matchups: Matchup[];
  regions: { id: number; slug: string }[];
};

export const regionOrder = ["East", "South", "West", "Midwest"];
const roundCodes = ["first-four", "r64", "r32", "s16", "e8"];

export function regionFor(bracket: Tournament, game: Matchup): string | null {
  if (game.roundId >= 5) return null;
  if (game.roundId === 0) {
    const slug = bracket.regions.find(
      (region) => region.id === game.regionId,
    )?.slug;
    const region = regionOrder.find((name) => name.toLowerCase() === slug);
    if (!region) throw new Error(`Unknown First Four region: ${game.regionId}`);
    return region;
  }
  return regionOrder[
    Math.floor((game.bracketLocation - 1) / (8 / 2 ** (game.roundId - 1)))
  ];
}

// Our games.game_id for a source matchup.
export function gameIdFor(bracket: Tournament, game: Matchup): string {
  if (game.roundId === 0) return `first-four-${game.bracketLocation}`;
  if (game.roundId === 5) return `ff-${game.bracketLocation}`;
  if (game.roundId === 6) return "championship";
  const region = regionFor(bracket, game)!;
  const slotsPerRegion = 8 / 2 ** (game.roundId - 1);
  const localSlot = (game.bracketLocation - 1) % slotsPerRegion;
  return `${region.toLowerCase()}-${roundCodes[game.roundId]}-${game.roundId === 1 ? localSlot + 1 : localSlot}`;
}
