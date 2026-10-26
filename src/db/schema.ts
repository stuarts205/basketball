import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  abbreviation: text("abbreviation").notNull(),
  name: text("name").notNull(),
  nickname: text("nickname").notNull(),
  color: text("color").notNull(),
  alternateColor: text("alternate_color").notNull(),
  logo: text("logo").notNull(),
  seed: integer("seed"),
  region: text("region").notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull().unique(),
  year: integer("year").notNull(),
  region: text("region"),
  round: text("round").notNull(),
  team1Id: uuid("team1_id").references(() => teams.id),
  team2Id: uuid("team2_id").references(() => teams.id),
  winnerTeamId: uuid("winner_team_id").references(() => teams.id),
  actualWinnerTeamId: uuid("actual_winner_team_id").references(() => teams.id),
});
