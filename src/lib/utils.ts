import { BASE_GAP, CARD_H, Match, Region, Team } from "./types";
import mockBracket from "../../data/data.json";

export function roundLayout(r: number): { gap: number; topPad: number } {
  const gaps: number[] = [BASE_GAP];
  for (let i = 1; i <= r; i++) gaps[i] = CARD_H + 2 * gaps[i - 1];
  let topPad = 0;
  for (let i = 1; i <= r; i++) topPad += CARD_H / 2 + gaps[i - 1] / 2;
  return { gap: gaps[r], topPad };
}

export function emptyMatch(id: string, topSeed?: number, botSeed?: number) {
  return {
    id,
    teams: [
      topSeed != null ? { seed: topSeed, name: "" } : null,
      botSeed != null ? { seed: botSeed, name: "" } : null,
    ],
    winner: null as Team | null,
    score: [null, null] as [number | null, number | null],
    status: "upcoming" as const,
  };
}

export function buildInitialState() {
  const regions: Region[] = mockBracket.regions.map((region: any) => {
    const firstRound = region.rounds.find((r: any) => r.name === "First Round");

    return {
      name: region.name,
      rounds: [
        // First Round
        {
          name: "First Round",
          matches: firstRound.matches.map((m: any): Match => ({
            id: m.id,
            teams: [
              m.teams[0] ? { seed: Number(m.teams[0].seed), name: m.teams[0].name } : null,
              m.teams[1] ? { seed: Number(m.teams[1].seed), name: m.teams[1].name } : null,
            ],
            winner: null,
            score: [null, null],
            status: "upcoming",
          })),
        },
        // Second Round
        {
          name: "Second Round",
          matches: Array.from({ length: 4 }, (_, i) =>
            emptyMatch(`${region.name.toLowerCase()}-r32-${i}`)
          ),
        },
        // Sweet 16
        {
          name: "Sweet 16",
          matches: Array.from({ length: 2 }, (_, i) =>
            emptyMatch(`${region.name.toLowerCase()}-s16-${i}`)
          ),
        },
        // Elite 8
        {
          name: "Elite 8",
          matches: [emptyMatch(`${region.name.toLowerCase()}-e8-0`)],
        },
      ],
    };
  });

  const ff: Match[] = mockBracket.finalFour.map((m: any, i: number): Match => {
    const regionIndexTop = i === 0 ? 0 : 2; 
    const regionIndexBottom = i === 0 ? 1 : 3; 

    const topRegionWinner: Team | null = regions[regionIndexTop].rounds[3].matches[0].winner
      ? {
          seed: regions[regionIndexTop].rounds[3].matches[0].winner.seed,
          name: regions[regionIndexTop].rounds[3].matches[0].winner.name,
        }
      : null;

    const bottomRegionWinner: Team | null = regions[regionIndexBottom].rounds[3].matches[0].winner
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

  let championshipWinner: Team | null = null;
  if (
    mockBracket.championship &&
    (mockBracket.championship as any).winner &&
    (mockBracket.championship as any).winner.seed &&
    (mockBracket.championship as any).winner.name
  ) {
    const winnerObj = (mockBracket.championship as any).winner;
    championshipWinner = { seed: Number(winnerObj.seed), name: winnerObj.name };
  }

  const championship: Match = {
    id: mockBracket.championship.id,
    teams: [null, null],
    winner: championshipWinner,
    score: [null, null],
    status: championshipWinner ? "final" : "upcoming",
  };

  return {
    regions,
    ff,
    championship,
  };
}
