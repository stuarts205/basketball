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
// Elite 8 cards slide back so the vertical connector runs through their middle.
export const ROUND_INSETS = [0, 0, CARD_W * 0.75, CONNECTOR_W + CARD_W / 2];
export const DESKTOP_REGION_GAP = 240;

export const GROUP_NAME_MAX_LENGTH = 50;

// Each member can fill out up to this many brackets in a group.
export const MAX_BRACKETS = 3;
export const BRACKET_NAME_MAX_LENGTH = 50;
// What bracket 1 is called until the user names it.
export const DEFAULT_BRACKET_NAME = "My Bracket";

// One of the user's brackets in a group. Bracket 1 always exists.
export type BracketSummary = {
  number: number;
  name: string;
};

// Private groups are joined with a PIN of this many digits.
export const GROUP_PIN_PATTERN = /^\d{4,8}$/;

export type GroupSummary = {
  id: string;
  name: string;
  memberCount: number;
  isPrivate: boolean;
};

// One of the user's groups whose bracket can seed an empty one.
export type PickSource = {
  id: string;
  name: string;
  pickCount: number;
};

export type UserGroup = {
  id: string;
  name: string;
  role: "admin" | "member";
};

// One of the user's groups and how far along their bracket in it is.
export type BracketChoice = UserGroup & {
  pickCount: number;
  champion: string | null;
};
