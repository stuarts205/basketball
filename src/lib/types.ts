export type Team = {
  seed: number;
  name: string;
  logo?: string;
  color?: string;
};
export type Match = {
  id: string;
  teams: [Team | null, Team | null];
  pendingTeams?: Partial<Record<0 | 1, Team[]>>;
  winner: Team | null;
  actualTeams?: [Team | null, Team | null];
  actualWinner?: Team | null;
  score: [number | null, number | null];
  status: "final" | "live" | "upcoming";
};
export type Round = { name: string; matches: Match[] };
export type Region = { name: string; rounds: Round[] };
export type FirstFourMatch = Match & {
  region: string;
  nextGameId: string;
  nextSlot: 0 | 1;
};
export type BracketState = {
  regions: Region[];
  firstFour?: FirstFourMatch[];
  ff: Match[];
  championship: Match;
};

export const CARD_W = 190;
export const CARD_H = 72;
export const ROW_H = 28;
export const BASE_GAP = 8;
export const COL_LABEL_H = 24;
export const CONNECTOR_W = 24;
export const ROUND_INSETS = [0, 0, CARD_W * 0.75, CONNECTOR_W];
export const DESKTOP_REGION_GAP = 240;
