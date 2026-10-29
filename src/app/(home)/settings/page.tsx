import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Tournament setup for the super admin; everyone else is sent to the bracket.
export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  if (!session.user.isSuperAdmin) redirect("/bracket");

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1 text-gray-800">Settings</h1>
          <p className="text-sm text-gray-400">
            Tournament setup. Only the super admin can see this page.
          </p>
        </div>
      </div>
    </div>
  );
}
