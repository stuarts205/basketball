import { AuthForm } from "@/components/auth-form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/bracket");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <AuthForm />
    </div>
  );
}
