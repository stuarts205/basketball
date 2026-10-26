import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  points: integer("points").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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
  actualWinnerTeamId: uuid("actual_winner_team_id").references(() => teams.id),
});

export const picks = pgTable(
  "picks",
  {
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    winnerTeamId: uuid("winner_team_id")
      .notNull()
      .references(() => teams.id),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId] }),
    index("picks_game_id_idx").on(table.gameId),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);