import { BracketState, FirstFourMatch, Match, Region, Team } from "./types";

const sourceUrl =
  "https://www.cbssports.com/college-basketball/ncaa-tournament/bracket/";
// Left side top to bottom, then right side, matching our desktop layout.
const regionPositions = ["top_left", "bottom_left", "top_right", "bottom_right"];
const roundNames = ["First Round", "Second Round", "Sweet 16", "Elite 8"];

type CbsTeam = {
  id: number;
  location: string;
  colorPrimaryHex?: string;
};
type CbsGame = {
  gameId: number;
  status: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
  gameParticipants: { seed: number; teamId: number | null; slotId: number }[];
  advancement: { winnerSlotId: number | null };
  gameData?: { winningTeamId?: number | null };
};
type CbsGroup = {
  name: string;
  position: string;
  rounds: { name: string; games: CbsGame[] }[];
};
type CbsBracket = {
  seasonYear: number;
  groups: CbsGroup[];
  picksTeams: Record<string, CbsTeam>;
};

// Downloads the bracket page and reads the data its script draws from.
async function fetchCbsBracket(): Promise<CbsBracket> {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30000),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`CBS returned HTTP ${response.status}`);
  const html = await response.text();
  const encoded = html.match(
    /define\('reduxPreloadedState'[\s\S]*?atob\(\s*'([^']+)'/,
  )?.[1];
  if (!encoded) throw new Error("CBS bracket data was not found");
  const state = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const bracket: CbsBracket | undefined = state.bracket?.data?.[0];
  if (!bracket?.groups?.length) throw new Error("CBS bracket data was empty");
  return bracket;
}

function statusOf(game: CbsGame): Match["status"] {
  if (game.status === "F") return "final";
  if (!game.status || game.status === "S" || game.status === "U")
    return "upcoming";
  return "live";
}

// Puts each round's games in bracket order: game k is fed by games 2k and
// 2k + 1 of the round before, and its top team comes from the earlier one.
function orderRound(previous: CbsGame[], games: CbsGame[]) {
  const feederIndex = (slotId: number) =>
    previous.findIndex((game) => game.advancement.winnerSlotId === slotId);
  const withSlots = games.map((game) => ({
    game,
    slots: [...game.gameParticipants]
      .sort((a, b) => feederIndex(a.slotId) - feederIndex(b.slotId))
      .map((participant) => participant.slotId),
    order: Math.min(
      ...game.gameParticipants.map((participant) =>
        feederIndex(participant.slotId),
      ),
    ),
  }));
  return withSlots
    .sort((a, b) => a.order - b.order)
    .map(({ game, slots }) => ({ game, slots }));
}

function firstRoundOrder(games: CbsGame[]) {
  return games
    .map((game) => ({
      game,
      slots: game.gameParticipants
        .map((participant) => participant.slotId)
        .sort((a, b) => a - b),
    }))
    .sort((a, b) => a.slots[0] - b.slots[0]);
}

export async function loadCbsBracket(): Promise<{
  state: BracketState;
  year: number;
}> {
  const bracket = await fetchCbsBracket();
  const toTeam = (teamId: number | null, seed: number): Team | null => {
    const team = teamId ? bracket.picksTeams[teamId] : undefined;
    if (!team) return null;
    return {
      seed,
      name: team.location,
      logo: `https://sports.cbsimg.net/fly/images/team-logos/${team.id}.svg`,
      color: team.colorPrimaryHex ? `#${team.colorPrimaryHex}` : undefined,
    };
  };
  const toMatch = ({
    game,
    slots,
  }: {
    game: CbsGame;
    slots: number[];
  }): Match => {
    const participants = slots.map((slotId) =>
      game.gameParticipants.find((participant) => participant.slotId === slotId),
    );
    const teams = participants.map((participant) =>
      participant ? toTeam(participant.teamId, participant.seed) : null,
    ) as [Team | null, Team | null];
    const status = statusOf(game);
    const scoreFor = (teamId: number | null | undefined) =>
      status === "upcoming" || !teamId
        ? null
        : teamId === game.homeTeamId
          ? game.homeScore
          : teamId === game.awayTeamId
            ? game.awayScore
            : null;
    const winnerId = status === "final" ? game.gameData?.winningTeamId : null;
    return {
      id: `cbs-${game.gameId}`,
      teams,
      winner:
        teams[participants.findIndex((p) => p?.teamId && p.teamId === winnerId)] ??
        null,
      score: participants.map((participant) =>
        scoreFor(participant?.teamId),
      ) as [number | null, number | null],
      status,
    };
  };

  const groupAt = (position: string) => {
    const group = bracket.groups.find((group) => group.position === position);
    if (!group) throw new Error(`CBS bracket is missing ${position}`);
    return group;
  };
  const regionGames = regionPositions.map((position) => {
    const ordered: { game: CbsGame; slots: number[] }[][] = [];
    groupAt(position).rounds.forEach((round, index) => {
      ordered.push(
        index === 0
          ? firstRoundOrder(round.games)
          : orderRound(
              ordered[index - 1].map(({ game }) => game),
              round.games,
            ),
      );
    });
    return ordered;
  });
  const regions: Region[] = regionPositions.map((position, index) => ({
    name: groupAt(position).name,
    rounds: regionGames[index].map((games, roundIndex) => ({
      name: roundNames[roundIndex],
      matches: games.map(toMatch),
    })),
  }));

  const eliteEight = regionGames.map((rounds) => rounds[3][0].game);
  const [semifinals, final] = groupAt("bottom").rounds;
  const ffOrdered = orderRound(eliteEight, semifinals.games);
  // Our layout plays the two left regions against each other.
  if (
    ffOrdered[0]?.slots.some(
      (slotId) =>
        ![eliteEight[0], eliteEight[1]].some(
          (game) => game.advancement.winnerSlotId === slotId,
        ),
    )
  ) {
    throw new Error("CBS Final Four pairings do not match the bracket layout");
  }
  const ff = ffOrdered.map(toMatch);
  const [championship] = orderRound(
    ffOrdered.map(({ game }) => game),
    final.games,
  ).map(toMatch);

  const firstRoundById = new Map(
    regionGames.flatMap((rounds, index) =>
      rounds[0].map((entry) => [entry, index] as const),
    ),
  );
  const firstFour: FirstFourMatch[] = (
    bracket.groups.find((group) => group.position === "top")?.rounds[0]
      ?.games ?? []
  ).flatMap((game) => {
    for (const [entry, regionIndex] of firstRoundById) {
      const nextSlot = entry.slots.indexOf(game.advancement.winnerSlotId ?? -1);
      if (nextSlot === -1) continue;
      return [
        {
          ...toMatch(firstRoundOrder([game])[0]),
          region: regions[regionIndex].name,
          nextGameId: `cbs-${entry.game.gameId}`,
          nextSlot: nextSlot as 0 | 1,
        },
      ];
    }
    return [];
  });

  return {
    state: { regions, firstFour, ff, championship },
    // CBS names the 2025-26 season by its starting year.
    year: bracket.seasonYear + 1,
  };
}
