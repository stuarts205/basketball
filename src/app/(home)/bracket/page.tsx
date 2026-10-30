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
import { PageHeader } from "@/components/page-header";
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
  // The super admin runs the tournament rather than playing, so they are
  // never made to join a group, choose one, or name a bracket.
  const isSuperAdmin = session.user.isSuperAdmin;
  // Members of several groups choose one each time they sign in.
  const mustChooseGroup =
    !isSuperAdmin &&
    userGroups.length > 1 &&
    cookieStore.get(ACTIVE_GROUP_SESSION_COOKIE)?.value !== session.session.id;
  // An unknown or missing ?b= shows the user's first bracket.
  const { b } = await searchParams;
  const [userBrackets, namedBracket] =
    activeGroup && !isSuperAdmin
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
  const [{ state, year, results, scores }, availableGroups, bracketChoices] =
    await Promise.all([
      loadBracketFromDatabase(
        activeGroup && activeBracket
          ? {
              userId: session.user.id,
              groupId: activeGroup.id,
              bracketNumber: activeBracket.number,
            }
          : undefined,
      ),
      activeGroup || isSuperAdmin ? [] : listGroups(),
      mustChooseGroup ? listBracketChoices(session.user.id) : [],
    ]);
  // A member with no bracket in the group yet names their first one before
  // picking. Without a named bracket only bracket 1 exists, so `state` is it.
  const mustNameBracket =
    !isSuperAdmin &&
    activeGroup !== null &&
    !mustChooseGroup &&
    !namedBracket &&
    !bracketMatches(state).some((match) => match.winner);
  const title = `${year} NCAA Tournament`;
  const subtitle = isSuperAdmin
    ? "Simulate results to set every game's winner for all groups"
    : activeGroup
      ? `${activeBracket?.name ?? "Your picks"} for ${activeGroup.name}. Click any team to advance them to the next round`
      : "Click any team to advance them to the next round";

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        {/* The bracket stays hidden until its name is saved. Otherwise it
            draws the title row itself, with its buttons on the same row. */}
        {mustNameBracket ? (
          <PageHeader title={title} subtitle={subtitle} />
        ) : (
          <FullBracket
            key={`${session.user.id}:${activeGroup?.id ?? ""}:${activeBracket?.number ?? 1}`}
            initialState={state}
            groupId={isSuperAdmin ? null : (activeGroup?.id ?? null)}
            bracketNumber={activeBracket?.number ?? 1}
            isSuperAdmin={isSuperAdmin}
            title={title}
            subtitle={subtitle}
            savedResults={results}
            savedScores={scores}
          />
        )}
      </div>
      {!activeGroup && !isSuperAdmin && (
        <GroupPickerModal groups={availableGroups} />
      )}
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
