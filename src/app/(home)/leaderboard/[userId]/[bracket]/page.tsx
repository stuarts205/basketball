import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FullBracket } from "@/components/full-bracket";
import { auth } from "@/lib/auth";
import { ACTIVE_GROUP_COOKIE } from "@/lib/groups";
import {
  leaderboardQuery,
  loadLeaderboard,
  resolveLeaderboardGroup,
} from "@/lib/leaderboard";
import { loadBracketFromDatabase } from "@/lib/load-bracket";

export const dynamic = "force-dynamic";

// A bracket opened from the leaderboard, read-only. Only brackets in the
// viewer's active group can be opened, or for the super admin, the group
// chosen on the leaderboard.
export default async function LeaderboardBracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; bracket: string }>;
  searchParams: Promise<{ page?: string; group?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [cookieStore, { userId, bracket }, query] = await Promise.all([
    cookies(),
    params,
    searchParams,
  ]);
  const isSuperAdmin = session.user.isSuperAdmin;
  const { group: activeGroup } = await resolveLeaderboardGroup({
    userId: session.user.id,
    isSuperAdmin,
    activeGroupId: cookieStore.get(ACTIVE_GROUP_COOKIE)?.value,
    requestedGroupId: query.group,
  });
  if (!activeGroup) redirect("/leaderboard");

  const entry = (await loadLeaderboard(activeGroup.id)).find(
    (candidate) =>
      candidate.userId === userId &&
      String(candidate.bracketNumber) === bracket,
  );
  if (!entry) notFound();

  const { state, year, results, scores } = await loadBracketFromDatabase({
    userId: entry.userId,
    groupId: activeGroup.id,
    bracketNumber: entry.bracketNumber,
  });
  // Returns to the standings page the bracket was opened from.
  const backHref = `/leaderboard${leaderboardQuery(
    Math.floor(Number(query.page)) || 1,
    isSuperAdmin ? activeGroup.id : undefined,
  )}`;

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <span aria-hidden>&larr;</span>
          Back to leaderboard
        </Link>
        <FullBracket
          initialState={state}
          groupId={activeGroup.id}
          bracketNumber={entry.bracketNumber}
          isSuperAdmin={false}
          readOnly
          title={`${entry.userName}'s ${year} Bracket`}
          subtitle={`${entry.bracketName} in ${activeGroup.name}`}
          savedResults={results}
          savedScores={scores}
        />
      </div>
    </div>
  );
}
