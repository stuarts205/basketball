import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

// Tournament setup for the super admin; everyone else is sent to the bracket.
export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  if (!session.user.isSuperAdmin) redirect("/bracket");

  return (
    <div className="min-h-screen bg-court p-6 pt-16 lg:px-3 lg:pt-6">
      <div className="w-full min-w-0 mx-auto">
        <PageHeader
          title="Settings"
          subtitle="Tournament setup. Only the super admin can see this page."
        />
      </div>
    </div>
  );
}
