"use client";
import {
  GROUP_NAME_MAX_LENGTH,
  GROUP_PIN_PATTERN,
  GroupSummary,
  UserGroup,
} from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

type Mode = "join" | "create";

// Without onClose the modal is blocking (first-time onboarding); with it the
// user can dismiss it, e.g. when joining an additional group. Users who
// already belong to groups choose whether the new group's bracket starts
// empty or as a copy of one of their existing brackets.
export const GroupPickerModal = ({
  groups,
  userGroups = [],
  activeGroupId = null,
  onClose,
}: {
  groups: GroupSummary[];
  userGroups?: UserGroup[];
  activeGroupId?: string | null;
  onClose?: () => void;
}) => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(groups.length ? "join" : "create");
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [createPin, setCreatePin] = useState("");
  // The private group whose PIN prompt is open in the join list.
  const [pinGroupId, setPinGroupId] = useState<string | null>(null);
  const [joinPin, setJoinPin] = useState("");
  const [copyPicks, setCopyPicks] = useState(false);
  const [copyFromId, setCopyFromId] = useState(
    activeGroupId ?? userGroups[0]?.id ?? "",
  );
  const copyPicksFrom = copyPicks && copyFromId ? copyFromId : undefined;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCreate = mode === "create";
  const busy = pendingId !== null;

  async function submit(id: string, request: Promise<Response>) {
    if (busy) return;
    setPendingId(id);
    setError(null);
    try {
      const response = await request;
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Something went wrong");
      }
      router.refresh();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPendingId(null);
    }
  }

  function handleJoin(groupId: string, pin?: string) {
    if (busy) return;
    submit(
      groupId,
      fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyPicksFrom, pin }),
      }),
    );
  }

  function openPinPrompt(groupId: string) {
    setPinGroupId(groupId);
    setJoinPin("");
    setError(null);
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    submit(
      "create",
      fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          copyPicksFrom,
          isPrivate,
          pin: isPrivate ? createPin : undefined,
        }),
      }),
    );
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-picker-title"
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2
            id="group-picker-title"
            className="text-2xl font-bold text-gray-800"
          >
            {onClose ? "Join another group" : "Pick a group"}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
        <p className="mb-5 text-sm text-gray-400">
          {onClose
            ? "Join an existing group or start a new one."
            : "Join a group or start your own to continue your bracket."}
        </p>

        {userGroups.length > 0 && (
          <fieldset className="mb-5 flex flex-col gap-2 rounded border border-gray-200 p-3 text-sm text-gray-700">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Picks in the new group
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="picks-choice"
                checked={!copyPicks}
                onChange={() => setCopyPicks(false)}
                disabled={busy}
              />
              Start a fresh bracket
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="picks-choice"
                checked={copyPicks}
                onChange={() => setCopyPicks(true)}
                disabled={busy}
              />
              Copy my picks from
              <select
                value={copyFromId}
                onChange={(event) => {
                  setCopyFromId(event.target.value);
                  setCopyPicks(true);
                }}
                disabled={busy}
                aria-label="Group to copy picks from"
                className="min-w-0 max-w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-800"
              >
                {userGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-gray-400">
              Either way, each group keeps its own bracket. Changes in one
              group never affect another.
            </p>
          </fieldset>
        )}

        <div className="mb-5 grid grid-cols-2 rounded border border-gray-300 p-1 text-sm font-semibold">
          {(["join", "create"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchMode(option)}
              disabled={busy}
              aria-pressed={mode === option}
              className={`rounded px-3 py-1.5 ${mode === option ? "bg-ball-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {option === "join" ? "Join a group" : "Create a group"}
            </button>
          ))}
        </div>

        {isCreate ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Group name
              <input
                type="text"
                required
                autoFocus
                maxLength={GROUP_NAME_MAX_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 font-normal text-gray-800 focus:border-ball-500 focus:outline-none focus:ring-2 focus:ring-ball-500/20"
              />
            </label>
            <p className="-mt-2 text-xs text-gray-400">
              You&apos;ll be the admin of this group.
            </p>
            <fieldset className="flex flex-col gap-2 text-sm text-gray-700">
              <legend className="mb-1 font-semibold">Who can join?</legend>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="group-privacy"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                  disabled={busy}
                  className="mt-1"
                />
                <span>
                  Public
                  <span className="block text-xs text-gray-400">
                    Anyone can join.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="group-privacy"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                  disabled={busy}
                  className="mt-1"
                />
                <span>
                  Private
                  <span className="block text-xs text-gray-400">
                    People need a PIN you give them.
                  </span>
                </span>
              </label>
            </fieldset>
            {isPrivate && (
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Join PIN
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  minLength={4}
                  maxLength={8}
                  pattern="\d{4,8}"
                  value={createPin}
                  onChange={(e) =>
                    setCreatePin(e.target.value.replace(/\D/g, ""))
                  }
                  className="rounded border border-gray-300 px-3 py-2 font-normal tracking-widest text-gray-800 focus:border-ball-500 focus:outline-none focus:ring-2 focus:ring-ball-500/20"
                />
                <span className="text-xs font-normal text-gray-400">
                  4-8 digits. Share it with the people you want to invite.
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={
                busy ||
                !name.trim() ||
                (isPrivate && !GROUP_PIN_PATTERN.test(createPin))
              }
              className="rounded bg-ball-500 px-3 py-2 text-sm font-semibold text-white hover:bg-ball-600 disabled:cursor-wait disabled:opacity-50"
            >
              {busy ? "Creating group..." : "Create group"}
            </button>
          </form>
        ) : groups.length ? (
          <ul className="flex max-h-72 flex-col divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
            {groups.map((group) => (
              <li key={group.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800">
                      <span className="truncate">{group.name}</span>
                      {group.isPrivate && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500">
                          <LockIcon />
                          Private
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {group.memberCount}{" "}
                      {group.memberCount === 1 ? "member" : "members"}
                    </div>
                  </div>
                  {pinGroupId !== group.id && (
                    <button
                      type="button"
                      onClick={() =>
                        group.isPrivate
                          ? openPinPrompt(group.id)
                          : handleJoin(group.id)
                      }
                      disabled={busy}
                      className="shrink-0 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
                    >
                      {pendingId === group.id ? "Joining..." : "Join"}
                    </button>
                  )}
                </div>
                {pinGroupId === group.id && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleJoin(group.id, joinPin);
                    }}
                    className="mt-2 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      maxLength={8}
                      placeholder="Enter PIN"
                      aria-label={`PIN for ${group.name}`}
                      value={joinPin}
                      onChange={(e) =>
                        setJoinPin(e.target.value.replace(/\D/g, ""))
                      }
                      disabled={busy}
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm tracking-widest text-gray-800 focus:border-ball-500 focus:outline-none focus:ring-2 focus:ring-ball-500/20"
                    />
                    <button
                      type="submit"
                      disabled={busy || !GROUP_PIN_PATTERN.test(joinPin)}
                      className="shrink-0 rounded bg-ball-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-ball-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {pendingId === group.id ? "Joining..." : "Join"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinGroupId(null)}
                      disabled={busy}
                      className="shrink-0 rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500">
            {onClose ? "No other groups to join." : "No groups yet."}{" "}
            <button
              type="button"
              onClick={() => switchMode("create")}
              className="font-semibold text-gray-800 underline hover:text-gray-600"
            >
              {onClose ? "Create one" : "Create the first one"}
            </button>
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
