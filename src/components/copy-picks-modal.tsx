"use client";
import { PickSource } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

// Shown after switching to a group where the user has no picks yet: start
// that group's bracket from one of their other brackets, or start fresh.
export const CopyPicksModal = ({
  groupId,
  groupName,
  sources,
  defaultSourceId,
  onClose,
}: {
  groupId: string;
  groupName: string;
  sources: PickSource[];
  defaultSourceId?: string | null;
  onClose: () => void;
}) => {
  const router = useRouter();
  const [copy, setCopy] = useState(true);
  const [sourceId, setSourceId] = useState(
    sources.find((source) => source.id === defaultSourceId)?.id ??
      sources[0].id,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!copy) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/groups/${groupId}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyFrom: sourceId }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not copy picks");
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy picks");
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
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-picks-title"
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 id="copy-picks-title" className="mb-1 text-2xl font-bold text-gray-800">
          Your bracket for {groupName}
        </h2>
        <p className="mb-5 text-sm text-gray-400">
          You haven&apos;t made any picks in this group yet.
        </p>

        <fieldset className="mb-5 flex flex-col gap-3 text-sm text-gray-700">
          <legend className="sr-only">How to start this bracket</legend>
          <label className="flex flex-wrap items-center gap-2">
            <input
              type="radio"
              name="copy-choice"
              checked={copy}
              onChange={() => setCopy(true)}
              disabled={busy}
            />
            Use my bracket from
            <select
              value={sourceId}
              onChange={(event) => {
                setSourceId(event.target.value);
                setCopy(true);
              }}
              disabled={busy}
              aria-label="Group to copy picks from"
              className="min-w-0 max-w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-800"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.pickCount}{" "}
                  {source.pickCount === 1 ? "pick" : "picks"})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="copy-choice"
              checked={!copy}
              onChange={() => setCopy(false)}
              disabled={busy}
            />
            Make fresh picks for {groupName}
          </label>
          <p className="text-xs text-gray-400">
            Either way, changes in this group never affect your other brackets.
          </p>
        </fieldset>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-ball-500 px-3 py-2 text-sm font-semibold text-white hover:bg-ball-600 disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? "Copying picks..." : copy ? "Copy picks" : "Start fresh"}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
};
