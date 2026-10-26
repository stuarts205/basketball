import { loadBracketFromDatabase } from "@/lib/load-bracket";
import { FullBracket } from "@/components/full-bracket";
import { GroupPickerModal } from "@/components/group-picker-modal";
import {
  ACTIVE_GROUP_COOKIE,
  listGroups,
  listUserGroups,
  resolveActiveGroup,
} from "@/lib/groups";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [userGroups, cookieStore] = await Promise.all([
    listUserGroups(session.user.id),
    cookies(),
  ]);
  const activeGroup = resolveActiveGroup(
    userGroups,
    cookieStore.get(ACTIVE_GROUP_COOKIE)?.value,
  );
  // Each group has its own bracket, so only the active group's picks load.
  const [{ state, year }, availableGroups] = await Promise.all([
    loadBracketFromDatabase(
      activeGroup
        ? { userId: session.user.id, groupId: activeGroup.id }
        : undefined,
    ),
    activeGroup ? [] : listGroups(),
  ]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1 text-gray-800">
            {year} NCAA Tournament
          </h1>
          <p className="text-sm text-gray-400">
            {activeGroup
              ? `Your picks for ${activeGroup.name}. Click any team to advance them to the next round`
              : "Click any team to advance them to the next round"}
          </p>
        </div>
        <FullBracket
          key={`${session.user.id}:${activeGroup?.id ?? ""}`}
          initialState={state}
          groupId={activeGroup?.id ?? null}
        />
      </div>
      {!activeGroup && <GroupPickerModal groups={availableGroups} />}
    </div>
  );
}
