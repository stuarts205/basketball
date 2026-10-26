import { loadBracketFromDatabase } from "@/lib/load-bracket";
import { FullBracket } from "@/components/full-bracket";
import { SignOutButton } from "@/components/sign-out-button";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const { state, year } = await loadBracketFromDatabase(session.user.id);

  return (
    <div className="min-h-screen bg-gray-100 p-6 lg:px-3">
      <div className="w-full min-w-0 mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1 text-gray-800">
              {year} NCAA Tournament
            </h1>
            <p className="text-sm text-gray-400">
              Click any team to advance them to the next round
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
        <FullBracket
          key={session.user.id}
          initialState={state}
          canEdit
        />
      </div>
    </div>
  );
}
