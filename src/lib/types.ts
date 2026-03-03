export type Team  = { seed: number; name: string };
export type Match = {
  id: string;
  teams: [Team | null, Team | null];
  winner: Team | null;
  score: [number | null, number | null];
  status: "final" | "live" | "upcoming";
};
export type Round  = { name: string; matches: Match[] };
export type Region = { name: string; rounds: Round[] };

export const CARD_W      = 190;
export const CARD_H      = 72;
export const ROW_H       = 28;
export const BASE_GAP    = 8;
export const COL_LABEL_H = 24;
export const CONNECTOR_W = 24;


