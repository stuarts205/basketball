import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { games, teams } from "@/db/schema";
import { loadBracketFromDatabase } from "@/lib/load-bracket";

const regionalRounds = ["First Round", "Second Round", "Sweet 16", "Elite 8"];
const semifinalRegions = [
  ["East", "South"],
  ["West", "Midwest"],
];

function matchIndex(gameId: string) {
  const index = Number(gameId.match(/-(\d+)$/)?.[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export async function DELETE() {
  try {
    const reset = await db.transaction(async (tx) => {
      const [latest] = await tx
        .select({ year: games.year })
        .from(games)
        .orderBy(desc(games.year))
        .limit(1);
      if (!latest) return false;
      const rows = await tx
        .select()
        .from(games)
        .where(eq(games.year, latest.year))
        .for("update");
      const teamRows = await tx
        .select({ id: teams.id, seed: teams.seed })
        .from(teams);
      const seedById = new Map(teamRows.map((team) => [team.id, team.seed]));
      const destinations = rows
        .filter((game) => game.round === "First Four")
        .map((game) => {
          const seed = game.team1Id ? seedById.get(game.team1Id) : undefined;
          if (!seed) throw new Error("Invalid First Four seed");
          const targets = rows.filter(
            (candidate) =>
              candidate.round === "First Round" &&
              candidate.region === game.region &&
              [candidate.team1Id, candidate.team2Id].some(
                (id) => id && seedById.get(id) === 17 - seed,
              ),
          );
          if (targets.length !== 1)
            throw new Error("Invalid First Four destination");
          const target = targets[0];
          const firstSlotIsOpponent =
            target.team1Id && seedById.get(target.team1Id) === 17 - seed;
          return { target, firstSlotIsOpponent };
        });
      await tx
        .update(games)
        .set({ winnerTeamId: null, actualWinnerTeamId: null })
        .where(eq(games.year, latest.year));
      for (const { target, firstSlotIsOpponent } of destinations) {
        await tx
          .update(games)
          .set(firstSlotIsOpponent ? { team2Id: null } : { team1Id: null })
          .where(eq(games.id, target.id));
      }
      return true;
    });
    if (!reset)
      return Response.json({ error: "No tournament found" }, { status: 404 });
    return Response.json(await loadBracketFromDatabase());
  } catch {
    return Response.json({ error: "Could not reset picks" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("gameId" in body) ||
    typeof body.gameId !== "string" ||
    !("teamName" in body) ||
    typeof body.teamName !== "string"
  ) {
    return Response.json(
      { error: "gameId and teamName are required" },
      { status: 400 },
    );
  }

  const { gameId, teamName } = body as {
    gameId: string;
    teamName: string;
  };

  const result = await db.transaction(async (tx) => {
    const [game] = await tx
      .select({
        id: games.id,
        year: games.year,
        region: games.region,
        round: games.round,
        gameId: games.gameId,
        team1Id: games.team1Id,
        team2Id: games.team2Id,
        winnerTeamId: games.winnerTeamId,
      })
      .from(games)
      .where(eq(games.gameId, gameId))
      .limit(1)
      .for("update");

    const regionalRoundIndex = game ? regionalRounds.indexOf(game.round) : -1;
    const isSemifinal = game?.round === "Semifinal";
    const isChampionship = game?.round === "Championship";
    const isFirstFour = game?.round === "First Four";
    if (
      !game ||
      (regionalRoundIndex === -1 &&
        !isSemifinal &&
        !isChampionship &&
        !isFirstFour)
    ) {
      return { status: 404, body: { error: "Pickable game not found" } };
    }

    const [team] = await tx
      .select({ id: teams.id, seed: teams.seed })
      .from(teams)
      .where(eq(teams.name, teamName))
      .limit(1);

    if (!team) {
      return { status: 400, body: { error: "Team not found" } };
    }

    if (isFirstFour) {
      if (![game.team1Id, game.team2Id].includes(team.id)) {
        return {
          status: 400,
          body: { error: "Team is not part of this game" },
        };
      }
      if (!game.region || !team.seed) {
        return {
          status: 400,
          body: { error: "First Four game has no region or seed" },
        };
      }
      const regionalTeams = await tx
        .select({ id: teams.id, seed: teams.seed })
        .from(teams)
        .where(eq(teams.region, game.region));
      const seedById = new Map(
        regionalTeams.map((entry) => [entry.id, entry.seed]),
      );
      const firstRound = await tx
        .select()
        .from(games)
        .where(
          and(
            eq(games.year, game.year),
            eq(games.region, game.region),
            eq(games.round, "First Round"),
          ),
        )
        .for("update");
      const targets = firstRound.filter((candidate) =>
        [candidate.team1Id, candidate.team2Id].some(
          (id) => id && seedById.get(id) === 17 - team.seed!,
        ),
      );
      if (targets.length !== 1) {
        return {
          status: 409,
          body: { error: "First Four destination could not be resolved" },
        };
      }
      const target = targets[0];
      const firstSlotIsOpponent =
        target.team1Id && seedById.get(target.team1Id) === 17 - team.seed;
      const previousEntrant = firstSlotIsOpponent
        ? target.team2Id
        : target.team1Id;
      if (
        previousEntrant &&
        ![game.team1Id, game.team2Id].includes(previousEntrant)
      ) {
        return {
          status: 409,
          body: { error: "First Four destination contains an unexpected team" },
        };
      }
      await tx
        .update(games)
        .set({ winnerTeamId: team.id })
        .where(eq(games.id, game.id));
      await tx
        .update(games)
        .set(firstSlotIsOpponent ? { team2Id: team.id } : { team1Id: team.id })
        .where(eq(games.id, target.id));
      if (previousEntrant && previousEntrant !== team.id) {
        await tx
          .update(games)
          .set({ winnerTeamId: null })
          .where(
            and(
              eq(games.year, game.year),
              ne(games.round, "First Four"),
              eq(games.winnerTeamId, previousEntrant),
            ),
          );
        await tx
          .update(games)
          .set({ team1Id: null })
          .where(
            and(
              eq(games.year, game.year),
              ne(games.round, "First Four"),
              eq(games.team1Id, previousEntrant),
            ),
          );
        await tx
          .update(games)
          .set({ team2Id: null })
          .where(
            and(
              eq(games.year, game.year),
              ne(games.round, "First Four"),
              eq(games.team2Id, previousEntrant),
            ),
          );
      }
      return { status: 200, body: { saved: true, nextGameId: target.gameId } };
    }

    let participantIds: (string | null)[] = [game.team1Id, game.team2Id];
    if (regionalRoundIndex === 0) {
      if (!game.region) {
        return { status: 400, body: { error: "Regional game has no region" } };
      }
    } else if (regionalRoundIndex > 0) {
      if (!game.region) {
        return { status: 400, body: { error: "Regional game has no region" } };
      }
      const index = matchIndex(game.gameId);
      if (index === null) {
        return { status: 400, body: { error: "Invalid second-round game ID" } };
      }

      const feederGames = await tx
        .select({ gameId: games.gameId, winnerTeamId: games.winnerTeamId })
        .from(games)
        .where(
          and(
            eq(games.year, game.year),
            eq(games.region, game.region),
            eq(games.round, regionalRounds[regionalRoundIndex - 1]),
          ),
        );
      feederGames.sort((a, b) =>
        a.gameId.localeCompare(b.gameId, undefined, { numeric: true }),
      );
      const feederWinners = feederGames
        .slice(index * 2, index * 2 + 2)
        .map((feeder) => feeder.winnerTeamId);
      participantIds = feederWinners;
      if (participantIds.length !== 2 || participantIds.some((id) => !id)) {
        return {
          status: 409,
          body: { error: "Both feeder games need winners before this pick" },
        };
      }
    } else if (isSemifinal) {
      const semifinalNumber = matchIndex(game.gameId);
      const index = semifinalNumber === null ? null : semifinalNumber - 1;
      if (index === null || index < 0 || index >= semifinalRegions.length) {
        return { status: 400, body: { error: "Invalid semifinal game ID" } };
      }
      const regionalWinners = await tx
        .select({
          region: games.region,
          winnerTeamId: games.winnerTeamId,
          gameId: games.gameId,
        })
        .from(games)
        .where(
          and(
            eq(games.year, game.year),
            inArray(games.region, semifinalRegions[index]),
            eq(games.round, "Elite 8"),
          ),
        );
      const winnersByRegion = new Map(
        regionalWinners.map((row) => [row.region, row.winnerTeamId]),
      );
      participantIds = semifinalRegions[index].map(
        (region) => winnersByRegion.get(region) ?? null,
      );
      if (participantIds.some((id) => !id)) {
        return {
          status: 409,
          body: { error: "Both Elite 8 games need winners before this pick" },
        };
      }
    } else if (isChampionship) {
      const semifinals = await tx
        .select({ gameId: games.gameId, winnerTeamId: games.winnerTeamId })
        .from(games)
        .where(and(eq(games.year, game.year), eq(games.round, "Semifinal")));
      semifinals.sort((a, b) =>
        a.gameId.localeCompare(b.gameId, undefined, { numeric: true }),
      );
      participantIds = semifinals
        .slice(0, 2)
        .map((semifinal) => semifinal.winnerTeamId);
      if (participantIds.length !== 2 || participantIds.some((id) => !id)) {
        return {
          status: 409,
          body: { error: "Both semifinals need winners before this pick" },
        };
      }
    }

    if (!participantIds.includes(team.id)) {
      return { status: 400, body: { error: "Team is not part of this game" } };
    }

    await tx
      .update(games)
      .set({ winnerTeamId: team.id })
      .where(eq(games.id, game.id));

    if (game.winnerTeamId && game.winnerTeamId !== team.id && regionalRoundIndex >= 0) {
      const dependentRounds = regionalRounds.slice(regionalRoundIndex + 1);
      if (dependentRounds.length > 0) {
        await tx
          .update(games)
          .set({ winnerTeamId: null })
          .where(
            and(
              eq(games.year, game.year),
              eq(games.region, game.region!),
              inArray(games.round, dependentRounds),
              eq(games.winnerTeamId, game.winnerTeamId),
            ),
          );
      }
      const semifinalIndex = semifinalRegions.findIndex((regions) =>
        regions.includes(game.region!),
      );
      const semifinalIds = await tx
        .select({ gameId: games.gameId })
        .from(games)
        .where(and(eq(games.year, game.year), eq(games.round, "Semifinal")));
      semifinalIds.sort((a, b) =>
        a.gameId.localeCompare(b.gameId, undefined, { numeric: true }),
      );
      if (semifinalIndex >= 0 && semifinalIds[semifinalIndex]) {
        await tx
          .update(games)
          .set({ winnerTeamId: null })
          .where(
            and(
              eq(games.gameId, semifinalIds[semifinalIndex].gameId),
              eq(games.winnerTeamId, game.winnerTeamId),
            ),
          );
      }
      await tx
        .update(games)
        .set({ winnerTeamId: null })
        .where(
          and(
            eq(games.year, game.year),
            eq(games.round, "Championship"),
            eq(games.winnerTeamId, game.winnerTeamId),
          ),
        );
    } else if (game.winnerTeamId && game.winnerTeamId !== team.id && isSemifinal) {
      await tx
        .update(games)
        .set({ winnerTeamId: null })
        .where(
          and(
            eq(games.year, game.year),
            eq(games.round, "Championship"),
            eq(games.winnerTeamId, game.winnerTeamId),
          ),
        );
    }

    return { status: 200, body: { saved: true } };
  });

  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }
  return Response.json({ ...result.body, ...(await loadBracketFromDatabase()) });
}
