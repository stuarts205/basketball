"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const SignOutButton = () => {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
    >
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  );
};
