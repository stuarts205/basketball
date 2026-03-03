import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
    id: serial("id").primaryKey(),
    teamId: text("team_id").notNull().unique(),
    slug: text("slug").notNull().unique(),
    abbreviation: text("abbreviation").notNull(),
    name: text("name").notNull(),
    nickname: text("nickname").notNull(),
    color: text("color").notNull(),
    alternateColor: text("alternate_color").notNull(),
    logo: text("logo").notNull(),
})