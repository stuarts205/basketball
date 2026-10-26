This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Tournament Data

The database importer uses ESPN's 2025-26 men's NCAA tournament bracket, including
all 68 teams and 67 games. Only First Four and First Round participants are imported;
later rounds start empty. First Round slots fed by the First Four are left empty.
Set `DATABASE_URL` in `.env` first.

```bash
npm run db:seed -- --dry-run
npm run db:seed -- --replace
```

`--replace` deletes existing games and teams, including all users' saved picks,
and imports the verified tournament in one transaction. Without `--replace`, the
importer updates shared matchup data while preserving user picks in the separate
`picks` table. First Four entrants are derived per user, never written into shared
games. Validation failures roll back database changes.
The source snapshot is saved in `data/tournament-2026.json`; add `--refresh` to
fetch it again from ESPN. The older `data/data.json` file is sample data and is not
used by this importer. First Four games appear below the main bracket; choosing a
winner fills the corresponding First Round slot. Changing that pick removes the
previous entrant from subsequent local picks.

The bracket starts with First Round teams populated and does not display official
results. Each pick is stored in `picks` with a text `user_id`, a UUID `game_id`
referencing the shared game, and a UUID `winner_team_id`. The composite primary
key allows one pick per user per game. First Four advancement and later-round
participants are derived from that user's picks and restored on refresh.
Changing a pick clears invalid downstream picks only for that user; Reset Picks
clears only that user's current tournament picks. Neither operation modifies
shared games or official results. The response includes the updated user bracket.

Pick writes require a Better Auth session; the user ID comes from the session,
not the request body. Signed-out visitors see an unpicked bracket and cannot
save or reset picks. The Better Auth handler is mounted at `/api/auth/*`.
Sign-in UI and login-provider configuration are not included yet.

Run `npm run test:picks` to check completed-bracket edits against the configured
database. The regression test runs inside a rolled-back transaction using an
isolated schema and checks completed-bracket edits, user isolation, anonymous
rejection, and reset behavior. Existing tournament data is not modified.

## Groups

Any signed-in user can create a group; the creator is stored in
`group_members` with the `admin` role. Group names are unique regardless of case.
Signed-in users who belong to no group see a modal on `/bracket` that lists
existing groups to join or lets them create one. Routes: `GET /api/groups`,
`POST /api/groups` (`{ name, copyPicksFrom? }`), and
`POST /api/groups/:groupId/members` (join, `{ copyPicksFrom? }`).

Picks are stored per user **per group**: `picks` is keyed by
`(user_id, group_id, game_id)` and references `group_members`, so a user's
bracket in one group never changes their bracket in another, and leaving a
group deletes that group's picks. `/bracket` shows the active group's bracket;
`PUT /api/games/winner` takes `groupId` in its body and
`DELETE /api/games/winner?groupId=...` resets one group's bracket. When a user
who already belongs to a group joins or creates another, they choose to start
a fresh bracket (the default) or copy their picks from one of their groups.

#### Migrating picks that predate groups

Before running `npx drizzle-kit push` for this change, assign existing picks
to each user's default group (the first by name, matching the app's fallback
active group). Picks of users in no group are dropped.

```sql
ALTER TABLE picks ADD COLUMN group_id uuid;
UPDATE picks p SET group_id = (
  SELECT gm.group_id FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE gm.user_id = p.user_id
  ORDER BY g.name LIMIT 1
);
DELETE FROM picks WHERE group_id IS NULL;
```

Then `npx drizzle-kit push` makes the column required and switches the primary
and foreign keys.

## Getting Started

### Database schema

Set `DATABASE_URL` in `.env`, then run `npx drizzle-kit push` to apply the
Drizzle schema. This change creates `picks` and drops the old shared
`games.winner_team_id` column, intentionally clearing legacy shared picks while
preserving games, teams, and official results. Review that drop when prompted.
Do not use `--replace` to migrate existing data.

Auth IDs and their foreign keys use text columns. Better Auth generates
UUID-formatted strings and uses the same schema through its Drizzle adapter.

Run `npx tsx --test src/db/schema.test.ts` to check foreign-key type compatibility
without connecting to the database.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
