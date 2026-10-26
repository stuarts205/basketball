import { BASE_GAP, CARD_H, Match, Region, Team } from "./types";
import mockBracket from "../../data/data.json";

export function roundLayout(r: number): { gap: number; topPad: number } {
  const gaps: number[] = [BASE_GAP];
  for (let i = 1; i <= r; i++) gaps[i] = CARD_H + 2 * gaps[i - 1];
  let topPad = 0;
  for (let i = 1; i <= r; i++) topPad += CARD_H / 2 + gaps[i - 1] / 2;
  return { gap: gaps[r], topPad };
}

export function emptyMatch(
  id: string,
  topSeed?: number,
  botSeed?: number,
): Match {
  return {
    id,
    teams: [
      topSeed != null ? { seed: topSeed, name: "" } : null,
      botSeed != null ? { seed: botSeed, name: "" } : null,
    ] as [Team | null, Team | null],
    winner: null as Team | null,
    score: [null, null] as [number | null, number | null],
    status: "upcoming" as const,
  };
}

export function buildInitialState() {
  const regions: Region[] = mockBracket.regions.map((region: any) => {
    return {
      name: region.name,
      rounds: region.rounds.map((round: any) => ({
        name: round.name,
        matches: round.matches.map((m: any): Match => {
          if (round.name !== "First Round") return emptyMatch(m.id);

          return {
            id: m.id,
            teams: [
              m.teams[0]
                ? { seed: Number(m.teams[0].seed), name: m.teams[0].name }
                : null,
              m.teams[1]
                ? { seed: Number(m.teams[1].seed), name: m.teams[1].name }
                : null,
            ],
            winner: null,
            score: [null, null],
            status: "upcoming",
          };
        }),
      })),
    };
  });

  const ff: Match[] = mockBracket.finalFour.map((m: any, i: number): Match => {
    const regionIndexTop = i === 0 ? 0 : 2;
    const regionIndexBottom = i === 0 ? 1 : 3;

    const topRegionWinner: Team | null = regions[regionIndexTop].rounds[3]
      .matches[0].winner
      ? {
          seed: regions[regionIndexTop].rounds[3].matches[0].winner.seed,
          name: regions[regionIndexTop].rounds[3].matches[0].winner.name,
        }
      : null;

    const bottomRegionWinner: Team | null = regions[regionIndexBottom].rounds[3]
      .matches[0].winner
      ? {
          seed: regions[regionIndexBottom].rounds[3].matches[0].winner.seed,
          name: regions[regionIndexBottom].rounds[3].matches[0].winner.name,
        }
      : null;

    return {
      id: m.id,
      teams: [topRegionWinner, bottomRegionWinner],
      winner: null,
      score: [null, null],
      status: "upcoming",
    };
  });

  const championship: Match = {
    id: mockBracket.championship.id,
    teams: [null, null],
    winner: null,
    score: [null, null],
    status: "upcoming",
  };

  return {
    regions,
    ff,
    championship,
  };
}
