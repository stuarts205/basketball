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

`--replace` deletes existing games and teams, including saved picks, and imports the
verified tournament in one transaction. Without `--replace`, the importer updates
matchup data while preserving saved First Four winners and their First Round slots.
Official result fields on those games are cleared; saved pick fields are preserved. Validation
failures roll back database changes.
The source snapshot is saved in `data/tournament-2026.json`; add `--refresh` to
fetch it again from ESPN. The older `data/data.json` file is sample data and is not
used by this importer. First Four games appear below the main bracket; choosing a
winner fills the corresponding First Round slot. Changing that pick removes the
previous entrant from subsequent local picks.

The bracket starts with First Round teams populated and does not display official
results. First Four picks save to the database and update the corresponding First
Round participant in the same transaction. They remain selected after refresh.
Every pick saves to `winner_team_id` and is restored on refresh. Reset Picks clears them.
Changing a pick clears only later picks for the previous winner, preserving unrelated
picks. After each save, the screen uses the bracket returned by the server so displayed
participants and saved picks stay in sync.

Run `npm run test:picks` to check completed-bracket edits against the configured
database. The regression test runs inside a rolled-back transaction and verifies
that existing picks are unchanged afterward; it temporarily locks game rows.

## Getting Started

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
