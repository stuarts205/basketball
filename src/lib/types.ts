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
// The round before the 64-team bracket: 12 games whose winners fill First
// Round slots. It replaced the four-game First Four in 2027.
export const OPENING_ROUND = "Opening Round";

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
// Space between a region's name and its first games (Tailwind gap-3).
export const REGION_NAME_GAP = 12;
// The strip above each region's games: the 24px region name and the gap.
export const COL_LABEL_H = 24 + REGION_NAME_GAP;
export const CONNECTOR_W = 24;
// Elite 8 cards slide back so the vertical connector runs through their middle.
export const ROUND_INSETS = [0, 0, CARD_W * 0.6, CONNECTOR_W + CARD_W / 2];
export const DESKTOP_REGION_GAP = 240;
// Lines joining games: white, with a dark edge (BRACKET_LINE_CLASS on the
// svg) so they show up on the light wood.
export const BRACKET_LINE_COLOR = "#ffffff";
export const BRACKET_LINE_CLASS =
  "[filter:drop-shadow(0_0_1px_rgb(28_23_21/0.55))]";
// Space between a region's round names and its region name (Tailwind gap-6).
export const ROUND_NAMES_GAP = 24;

export const GROUP_NAME_MAX_LENGTH = 50;

// "1" when the user has collapsed the desktop sidebar.
export const SIDEBAR_COOKIE = "sidebar_collapsed";

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
