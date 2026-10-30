"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const LoadBracketButton = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/bracket", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not load the bracket");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-ball-500 px-4 py-2 text-sm font-semibold text-white hover:bg-ball-600 disabled:cursor-wait disabled:opacity-50"
      >
        {loading
          ? "Loading teams and games..."
          : "Load the tournament bracket"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};
