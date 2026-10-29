import { bracketMatches, loadBracketFromDatabase } from "@/lib/load-bracket";
import { FullBracket } from "@/components/full-bracket";
import { GroupChooserModal } from "@/components/group-chooser-modal";
import { GroupPickerModal } from "@/components/group-picker-modal";
import {
  ACTIVE_GROUP_COOKIE,
  ACTIVE_GROUP_SESSION_COOKIE,
  listBracketChoices,
  listGroups,
  listUserGroups,
  resolveActiveGroup,
} from "@/lib/groups";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { games } from "@/db/schema";
import { LoadBracketButton } from "@/components/load-bracket-button";
import { EmptyBracket } from "@/components/empty-bracket";
import { NewBracketModal } from "@/components/new-bracket-modal";
import { hasNamedBracket, listBrackets } from "@/lib/brackets";

export const dynamic = "force-dynamic";

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string | string[] }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [anyGame] = await db.select({ id: games.id }).from(games).limit(1);
  if (!anyGame) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-court p-6">
        {session.user.isSuperAdmin ? (
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
            <h1 className="mb-1 text-2xl font-bold text-gray-800">
              No bracket yet
            </h1>
            <p className="mb-6 text-sm text-gray-400">
              Load the teams and games to set up the tournament.
            </p>
            <LoadBracketButton />
          </div>
        ) : (
          <EmptyBracket />
        )}
      </div>
    );
  }

  const [userGroups, cookieStore] = await Promise.all([
    listUserGroups(session.user.id),
    cookies(),
  ]);
  const activeGroup = resolveActiveGroup(
    userGroups,
    cookieStore.get(ACTIVE_GROUP_COOKIE)?.value,
  );
  // Members of several groups choose one each time they sign in.
  const mustChooseGroup =
    userGroups.length > 1 &&
    cookieStore.get(ACTIVE_GROUP_SESSION_COOKIE)?.value !== session.session.id;
  // An unknown or missing ?b= shows the user's first bracket.
  const { b } = await searchParams;
  const [userBrackets, namedBracket] = activeGroup
    ? await Promise.all([
        listBrackets(session.user.id, activeGroup.id),
        hasNamedBracket(session.user.id, activeGroup.id),
      ])
    : [[], false];
  const activeBracket =
    userBrackets.find((bracket) => String(bracket.number) === b) ??
    userBrackets[0] ??
    null;
  // Each group has its own brackets, so only the shown bracket's picks load.
  const [{ state, year }, availableGroups, bracketChoices] = await Promise.all([
    loadBracketFromDatabase(
      activeGroup && activeBracket
        ? {
            userId: session.user.id,
            groupId: activeGroup.id,
            bracketNumber: activeBracket.number,
          }
        : undefined,
    ),
    activeGroup ? [] : listGroups(),
    mustChooseGroup ? listBracketChoices(session.user.id) : [],
  ]);
  // A member with no bracket in the group yet names their first one before
  // picking. Without a named bracket only bracket 1 exists, so `state` is it.
  const mustNameBracket =
    activeGroup !== null &&
    !mustChooseGroup &&
    !namedBracket &&
    !bracketMatches(state).some((match) => match.winner);

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1 text-gray-800">
            {year} NCAA Tournament
          </h1>
          <p className="text-sm text-gray-400">
            {activeGroup
              ? `${activeBracket?.name ?? "Your picks"} for ${activeGroup.name}. Click any team to advance them to the next round`
              : "Click any team to advance them to the next round"}
          </p>
        </div>
        {/* The bracket stays hidden until its name is saved. */}
        {!mustNameBracket && (
          <FullBracket
            key={`${session.user.id}:${activeGroup?.id ?? ""}:${activeBracket?.number ?? 1}`}
            initialState={state}
            groupId={activeGroup?.id ?? null}
            groupName={activeGroup?.name ?? null}
            bracketNumber={activeBracket?.number ?? 1}
            bracketName={activeBracket?.name ?? null}
          />
        )}
      </div>
      {!activeGroup && <GroupPickerModal groups={availableGroups} />}
      {mustNameBracket && activeGroup && (
        <NewBracketModal
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          bracketNumber={1}
          first
        />
      )}
      {mustChooseGroup && (
        <GroupChooserModal
          choices={bracketChoices}
          totalGames={bracketMatches(state).length}
          defaultGroupId={activeGroup?.id ?? null}
        />
      )}
    </div>
  );
}
