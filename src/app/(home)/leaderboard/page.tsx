import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { ACTIVE_GROUP_COOKIE } from "@/lib/groups";
import { TrophyIcon } from "@/lib/icons";
import {
  LeaderboardEntry,
  leaderboardQuery,
  loadLeaderboard,
  resolveLeaderboardGroup,
} from "@/lib/leaderboard";
import { percentWon } from "@/lib/scoring";
import { GroupSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const PODIUM_STYLES = [
  {
    label: "1st",
    card: "border-amber-300 bg-gradient-to-br from-amber-50 to-white",
    badge: "bg-amber-400 text-amber-950",
  },
  {
    label: "2nd",
    card: "border-slate-300 bg-gradient-to-br from-slate-100 to-white",
    badge: "bg-slate-300 text-slate-900",
  },
  {
    label: "3rd",
    card: "border-orange-300 bg-gradient-to-br from-orange-50 to-white",
    badge: "bg-orange-300 text-orange-950",
  },
];

// Standings rows per page. Kept small for now.
const PAGE_SIZE = 3;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; group?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [cookieStore, query] = await Promise.all([cookies(), searchParams]);
  const isSuperAdmin = session.user.isSuperAdmin;
  const { group: activeGroup, choices } = await resolveLeaderboardGroup({
    userId: session.user.id,
    isSuperAdmin,
    activeGroupId: cookieStore.get(ACTIVE_GROUP_COOKIE)?.value,
    requestedGroupId: query.group,
  });
  const entries = activeGroup ? await loadLeaderboard(activeGroup.id) : [];
  // The super admin's links keep the group they chose.
  const linkedGroupId = isSuperAdmin ? activeGroup?.id : undefined;

  const ranked = entries.map((entry) => ({
    ...entry,
    place: entries.findIndex((other) => other.points === entry.points),
  }));

  const pageCount = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const requestedPage = Math.floor(Number(query.page)) || 1;
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const pageEntries = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <PageHeader
          title="Leaderboard"
          subtitle={
            activeGroup
              ? `Standings for ${activeGroup.name}`
              : isSuperAdmin
                ? "No groups yet"
                : "Join a group to see its standings"
          }
        />
        {choices.length > 1 && (
          <GroupPicker groups={choices} activeGroupId={activeGroup?.id} />
        )}
        {activeGroup && (
          <div className="grid gap-4 sm:grid-cols-3">
            {ranked.slice(0, 3).map((entry) => (
              <PodiumCard key={`${entry.userId}:${entry.bracketNumber}`} entry={entry} />
            ))}
            {ranked.length === 0 && (
              <p className="text-sm font-semibold text-gray-700 sm:col-span-3">
                No brackets in this group yet.
              </p>
            )}
          </div>
        )}
        {ranked.length > 0 && (
          <>
            <StandingsTable
              entries={pageEntries}
              currentUserId={session.user.id}
              page={page}
              groupId={linkedGroupId}
            />
            {pageCount > 1 && (
              <Pagination
                page={page}
                pageCount={pageCount}
                groupId={linkedGroupId}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// The super admin's choice of group, one link per group.
function GroupPicker({
  groups,
  activeGroupId,
}: {
  groups: GroupSummary[];
  activeGroupId: string | undefined;
}) {
  return (
    <nav aria-label="Groups" className="mb-4 flex flex-wrap gap-2">
      {groups.map((group) =>
        group.id === activeGroupId ? (
          <span
            key={group.id}
            aria-current="page"
            className="rounded-full bg-sideline-900 px-3 py-1.5 text-sm font-bold text-white"
          >
            {group.name}
          </span>
        ) : (
          <Link
            key={group.id}
            href={`/leaderboard${leaderboardQuery(1, group.id)}`}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            {group.name}
          </Link>
        ),
      )}
    </nav>
  );
}

function StandingsTable({
  entries,
  currentUserId,
  page,
  groupId,
}: {
  entries: (LeaderboardEntry & { place: number })[];
  currentUserId: string;
  page: number;
  // The super admin's chosen group, kept in the bracket links.
  groupId?: string;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" className="w-16 px-4 py-3 text-center">Rank</th>
            <th scope="col" className="px-4 py-3">Player</th>
            <th scope="col" className="px-4 py-3">Bracket</th>
            <th scope="col" className="px-4 py-3 text-right">Points</th>
            <th
              scope="col"
              className="px-4 py-3 text-right"
              title="Share of the points played so far that this bracket won"
            >
              Won
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => {
            // A table row can't be a link, so every cell links to the
            // bracket, with only the first in the tab order.
            const href = `/leaderboard/${encodeURIComponent(entry.userId)}/${entry.bracketNumber}${leaderboardQuery(page, groupId)}`;
            return (
              <tr
                key={`${entry.userId}:${entry.bracketNumber}`}
                className={`cursor-pointer transition-colors ${
                  entry.userId === currentUserId
                    ? "bg-orange-50 hover:bg-orange-200"
                    : "hover:bg-gray-200"
                }`}
              >
                <td className="text-center font-bold tabular-nums text-gray-700">
                  <Link
                    href={href}
                    aria-label={`View ${entry.userName}'s ${entry.bracketName}`}
                    className="block px-4 py-3"
                  >
                    {entry.place + 1}
                  </Link>
                </td>
                <td className="font-semibold text-gray-900">
                  <Link href={href} tabIndex={-1} className="block px-4 py-3">
                    {entry.userName}
                  </Link>
                </td>
                <td className="text-gray-500">
                  <Link href={href} tabIndex={-1} className="block px-4 py-3">
                    {entry.bracketName}
                  </Link>
                </td>
                <td className="text-right text-base font-black tabular-nums text-sideline-900">
                  <Link href={href} tabIndex={-1} className="block px-4 py-3">
                    {entry.points}
                  </Link>
                </td>
                <td className="text-right font-semibold tabular-nums text-gray-500">
                  <Link href={href} tabIndex={-1} className="block px-4 py-3">
                    {formatPercent(entry)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Points won out of the points played so far, or a dash before any game.
function formatPercent(entry: LeaderboardEntry) {
  const percent = percentWon(entry);
  return percent === null ? "–" : `${percent}%`;
}

function Pagination({
  page,
  pageCount,
  groupId,
}: {
  page: number;
  pageCount: number;
  groupId?: string;
}) {
  const pageHref = (number: number) =>
    `/leaderboard${leaderboardQuery(number, groupId)}`;
  const linkClass =
    "rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50";
  const disabledClass =
    "rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-400";
  return (
    <nav
      aria-label="Leaderboard pages"
      className="mt-3 flex items-center justify-between gap-2"
    >
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className={linkClass}>
          Previous
        </Link>
      ) : (
        <span className={disabledClass}>Previous</span>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((number) =>
          number === page ? (
            <span
              key={number}
              aria-current="page"
              className="rounded-md bg-sideline-900 px-3 py-1.5 text-sm font-bold text-white"
            >
              {number}
            </span>
          ) : (
            <Link key={number} href={pageHref(number)} className={linkClass}>
              {number}
            </Link>
          ),
        )}
      </div>
      {page < pageCount ? (
        <Link href={pageHref(page + 1)} className={linkClass}>
          Next
        </Link>
      ) : (
        <span className={disabledClass}>Next</span>
      )}
    </nav>
  );
}

function PodiumCard({ entry }: { entry: LeaderboardEntry & { place: number } }) {
  const style = PODIUM_STYLES[entry.place];
  return (
    <div className={`flex items-center gap-4 rounded-lg border p-5 shadow-sm ${style.card}`}>
      <div
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full ${style.badge}`}
      >
        {entry.place === 0 ? <TrophyIcon /> : null}
        <span className="text-xs font-black">{style.label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold text-gray-900">{entry.userName}</p>
        <p className="truncate text-sm text-gray-500">{entry.bracketName}</p>
      </div>
      <div className="text-right">
        <p className="text-3xl font-black tabular-nums text-sideline-900">{entry.points}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">pts</p>
        <p className="text-xs font-semibold tabular-nums text-gray-500">
          {formatPercent(entry)} won
        </p>
      </div>
    </div>
  );
}
