import { AdminMenuProvider } from "@/components/admin-menu";
import { AppSidebar } from "@/components/app-sidebar";
import {
  ACTIVE_GROUP_COOKIE,
  listGroups,
  listUserGroups,
  resolveActiveGroup,
} from "@/lib/groups";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasNamedBracket, listBrackets } from "@/lib/brackets";
import { loadBracketFromDatabase } from "@/lib/load-bracket";
import { SIDEBAR_COOKIE } from "@/lib/types";

export default async function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [userGroups, allGroups, cookieStore] = await Promise.all([
    listUserGroups(session.user.id),
    listGroups(),
    cookies(),
  ]);
  const activeGroup = resolveActiveGroup(
    userGroups,
    cookieStore.get(ACTIVE_GROUP_COOKIE)?.value,
  );
  // Brackets show in the menu once the user has named one in the group. The
  // super admin makes no picks, so has none.
  const userBrackets =
    activeGroup &&
    !session.user.isSuperAdmin &&
    (await hasNamedBracket(session.user.id, activeGroup.id))
      ? await listBrackets(session.user.id, activeGroup.id)
      : [];
  const joinedIds = new Set(userGroups.map((group) => group.id));
  const joinableGroups = allGroups.filter((group) => !joinedIds.has(group.id));
  // The super admin's menu on every page needs the tournament, once it's set
  // up; before then loading it fails and there is no menu.
  const tournament = session.user.isSuperAdmin
    ? await loadBracketFromDatabase().catch(() => null)
    : null;

  return (
    <AdminMenuProvider tournament={tournament}>
    <div className="flex min-h-screen bg-court">
      <AppSidebar
        userName={session.user.name || session.user.email}
        isSuperAdmin={session.user.isSuperAdmin}
        groups={userGroups}
        activeGroupId={activeGroup?.id ?? null}
        joinableGroups={joinableGroups}
        brackets={userBrackets}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "1"}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
    </AdminMenuProvider>
  );
}
