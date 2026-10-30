"use client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

// Confirms wiping every team, game, group, bracket and pick, then does it.
export const ResetDataModal = ({ onClose }: { onClose: () => void }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/reset", { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not reset the data");
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the data");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-data-title"
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2
          id="reset-data-title"
          className="mb-1 text-2xl font-bold text-gray-800"
        >
          Reset all data?
        </h2>
        <p className="mb-5 text-sm text-gray-500">
          This deletes every team, game, group, bracket and pick for everyone.
          User accounts are kept. This can&apos;t be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
          >
            {busy ? "Resetting..." : "Reset all data"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
