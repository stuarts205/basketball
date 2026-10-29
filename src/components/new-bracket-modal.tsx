"use client";
import {
  BRACKET_NAME_MAX_LENGTH,
  BracketSummary,
  DEFAULT_BRACKET_NAME,
} from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

// Names a new, empty bracket in the active group, then opens it. With
// `first`, names the user's first bracket in the group instead; that has to
// be done, so there's no way to dismiss it.
export const NewBracketModal = ({
  groupId,
  groupName,
  bracketNumber,
  first = false,
  onClose,
}: {
  groupId: string;
  groupName: string;
  // The number the new bracket will get, for the suggested name.
  bracketNumber: number;
  first?: boolean;
  onClose?: () => void;
}) => {
  const router = useRouter();
  const [name, setName] = useState(
    first ? DEFAULT_BRACKET_NAME : `Bracket ${bracketNumber}`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your bracket a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/groups/${groupId}/brackets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, first }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not add a bracket");
      const { bracket }: { bracket: BracketSummary } = body;
      router.push(`/bracket?b=${bracket.number}`);
      router.refresh();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add a bracket");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-bracket-title"
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2
          id="new-bracket-title"
          className="mb-1 text-2xl font-bold text-gray-800"
        >
          {first ? "Name your bracket" : "New bracket"}
        </h2>
        <p className="mb-5 text-sm text-gray-400">
          {first ? (
            <>
              Give your bracket for {groupName} a name before you start
              picking.
            </>
          ) : (
            <>
              Fill out another bracket for {groupName}. Your other brackets
              won&apos;t change.
            </>
          )}
        </p>

        <label className="mb-5 block text-sm font-semibold text-gray-700">
          Bracket name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BRACKET_NAME_MAX_LENGTH}
            disabled={busy}
            autoFocus
            onFocus={(event) => event.target.select()}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 font-normal text-gray-800"
          />
        </label>

        <div className="flex gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded bg-ball-500 px-3 py-2 text-sm font-semibold text-white hover:bg-ball-600 disabled:cursor-wait disabled:opacity-50"
          >
            {busy ? "Saving..." : first ? "Save name" : "Create bracket"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
};
