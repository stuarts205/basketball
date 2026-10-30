import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  points: integer("points").default(0).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
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
  // The final score, in the order of the teams that actually played the game
  // (top then bottom in the bracket).
  actualScore1: integer("actual_score1"),
  actualScore2: integer("actual_score2"),
});

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Private groups require join_pin to join; public groups have no PIN.
    isPrivate: boolean("is_private").default(false).notNull(),
    joinPin: text("join_pin"),
  },
  (table) => [uniqueIndex("groups_name_lower_idx").on(sql`lower(${table.name})`)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "member"] })
      .default("member")
      .notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    // The name and column order match how `drizzle-kit push` reads this key
    // back from the database; otherwise it tries to recreate it and fails on
    // the picks foreign key that depends on it.
    primaryKey({
      name: "group_members_group_id_user_id_pk",
      columns: [table.userId, table.groupId],
    }),
    index("group_members_user_id_idx").on(table.userId),
  ],
);

// Names for a member's brackets in a group. Bracket 1 always exists, with or
// without a row; brackets 2 and 3 exist once they have a row.
export const brackets = pgTable(
  "brackets",
  {
    groupId: uuid("group_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Column order matches how `drizzle-kit push` reads this key back, as for
    // group_members above.
    primaryKey({
      name: "brackets_group_id_user_id_number_pk",
      columns: [table.userId, table.number, table.groupId],
    }),
    foreignKey({
      columns: [table.groupId, table.userId],
      foreignColumns: [groupMembers.groupId, groupMembers.userId],
    }).onDelete("cascade"),
    check("brackets_number_range", sql`${table.number} between 1 and 3`),
  ],
);

// Picks belong to a membership, so each group has its own brackets per user
// and leaving a group drops that group's picks.
export const picks = pgTable(
  "picks",
  {
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull(),
    // Which of the member's brackets in the group (1 to 3) this pick is in.
    bracketNumber: integer("bracket_number").default(1).notNull(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    winnerTeamId: uuid("winner_team_id")
      .notNull()
      .references(() => teams.id),
  },
  (table) => [
    // Column order matches how `drizzle-kit push` reads this key back, as for
    // group_members above.
    primaryKey({
      name: "picks_user_id_group_id_bracket_number_game_id_pk",
      columns: [table.userId, table.groupId, table.gameId, table.bracketNumber],
    }),
    check("picks_bracket_number_range", sql`${table.bracketNumber} between 1 and 3`),
    index("picks_game_id_idx").on(table.gameId),
    foreignKey({
      columns: [table.groupId, table.userId],
      foreignColumns: [groupMembers.groupId, groupMembers.userId],
    }).onDelete("cascade"),
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