"use client";
import { BracketSummary } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const COPY = {
  reset: {
    title: "Reset picks?",
    body: "This clears every pick in",
    confirm: "Reset picks",
    busy: "Resetting...",
    failed: "Could not reset picks",
  },
  delete: {
    title: "Delete bracket?",
    body: "This deletes, with all its picks,",
    confirm: "Delete bracket",
    busy: "Deleting...",
    failed: "Could not delete the bracket",
  },
};

// Confirms resetting a bracket's picks or deleting the bracket, then does it.
// The user's other brackets don't change, except that brackets after a deleted
// one move up a number.
export const BracketConfirmModal = ({
  action,
  groupId,
  groupName,
  bracket,
  viewingNumber,
  onClose,
}: {
  action: "reset" | "delete";
  groupId: string;
  groupName: string;
  bracket: BracketSummary;
  // The bracket on screen, or null when not on the bracket page.
  viewingNumber: number | null;
  onClose: () => void;
}) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[action];

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const group = encodeURIComponent(groupId);
      const response = await fetch(
        action === "reset"
          ? `/api/games/winner?groupId=${group}&bracket=${bracket.number}`
          : `/api/groups/${group}/brackets?number=${bracket.number}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? copy.failed);
      }
      // After a delete, a bracket shown after the deleted one has moved up a
      // number, and the deleted one falls back to the first bracket.
      if (
        action === "delete" &&
        viewingNumber !== null &&
        viewingNumber >= bracket.number
      ) {
        const next = Math.max(
          1,
          viewingNumber === bracket.number ? 1 : viewingNumber - 1,
        );
        router.push(`/bracket?b=${next}`);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
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
        aria-labelledby="bracket-confirm-title"
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2
          id="bracket-confirm-title"
          className="mb-1 text-2xl font-bold text-gray-800"
        >
          {copy.title}
        </h2>
        <p className="mb-5 text-sm text-gray-500">
          {copy.body}{" "}
          <span className="font-semibold text-gray-800">{bracket.name}</span>{" "}
          for <span className="font-semibold text-gray-800">{groupName}</span>.{" "}
          {action === "delete" && "This can't be undone. "}
          Your other brackets won&apos;t change.
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
            {busy ? copy.busy : copy.confirm}
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
