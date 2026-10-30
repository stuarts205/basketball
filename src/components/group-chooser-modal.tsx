"use client";
import { CopyPicksModal } from "@/components/copy-picks-modal";
import { BracketChoice, PickSource, UserGroup } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

// Shown after signing in when the user belongs to more than one group: they
// pick which group's bracket to show. Blocking until a group is chosen.
export const GroupChooserModal = ({
  choices,
  totalGames,
  defaultGroupId,
}: {
  choices: BracketChoice[];
  totalGames: number;
  defaultGroupId: string | null;
}) => {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyPrompt, setCopyPrompt] = useState<{
    group: UserGroup;
    sources: PickSource[];
  } | null>(null);

  async function handleChoose(groupId: string) {
    if (pendingId) return;
    setPendingId(groupId);
    setError(null);
    try {
      const response = await fetch("/api/groups/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not open group");
      const { group, picksFrom }: { group: UserGroup; picksFrom: PickSource[] } =
        body;
      // An empty bracket can start as a copy of one from another group. The
      // refresh waits for that choice: once the group is chosen this modal
      // (and the prompt) is no longer rendered.
      if (picksFrom.length) setCopyPrompt({ group, sources: picksFrom });
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open group");
      setPendingId(null);
    }
  }

  if (copyPrompt)
    return (
      <CopyPicksModal
        groupId={copyPrompt.group.id}
        groupName={copyPrompt.group.name}
        sources={copyPrompt.sources}
        onClose={() => router.refresh()}
      />
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-chooser-title"
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2
          id="group-chooser-title"
          className="mb-1 text-2xl font-bold text-gray-800"
        >
          Choose a group
        </h2>
        <p className="mb-5 text-sm text-gray-400">
          You have a separate bracket in each group. Which one do you want to
          open?
        </p>

        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {choices.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => handleChoose(choice.id)}
                disabled={pendingId !== null}
                className={`flex w-full items-center gap-3 rounded border px-3 py-2.5 text-left hover:bg-gray-50 disabled:cursor-wait ${choice.id === defaultGroupId ? "border-gray-500" : "border-gray-200"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-800">
                    {choice.name}
                    {choice.role === "admin" && (
                      <span className="ml-1 text-xs font-normal text-gray-400">
                        admin
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {choice.pickCount
                      ? `${choice.pickCount} of ${totalGames} picks`
                      : "No picks yet"}
                    {choice.champion && ` · Champion: ${choice.champion}`}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-gray-600">
                  {pendingId === choice.id ? "Opening..." : "Open"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {choices.some((choice) => choice.id === defaultGroupId) && (
          <p className="mt-3 text-xs text-gray-400">
            Outlined: the group you had open last time.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
