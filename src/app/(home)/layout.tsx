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
  const joinedIds = new Set(userGroups.map((group) => group.id));
  const joinableGroups = allGroups.filter((group) => !joinedIds.has(group.id));

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppSidebar
        userName={session.user.name || session.user.email}
        groups={userGroups}
        activeGroupId={activeGroup?.id ?? null}
        joinableGroups={joinableGroups}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
