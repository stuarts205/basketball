"use client";
import { CopyPicksModal } from "@/components/copy-picks-modal";
import { GroupPickerModal } from "@/components/group-picker-modal";
import { authClient } from "@/lib/auth-client";
import { GroupSummary, PickSource, UserGroup } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

export const APP_NAME = "PickEm";

const NAV_ITEMS = [
  { href: "/bracket", label: "My Bracket", icon: BracketIcon },
  { href: "/live-bracket", label: " Live Bracket", icon: BracketIcon }
];

// Matches the page itself and pages nested under it, so "/bracket" isn't
// active on "/bracket-results".
function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function groupLabel(group: UserGroup | undefined) {
  if (!group) return "No group yet";
  return group.role === "admin" ? `${group.name} (admin)` : group.name;
}

export const AppSidebar = ({
  userName,
  isSuperAdmin,
  groups,
  activeGroupId,
  joinableGroups,
}: {
  userName: string;
  isSuperAdmin: boolean;
  groups: UserGroup[];
  activeGroupId: string | null;
  joinableGroups: GroupSummary[];
}) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copyPrompt, setCopyPrompt] = useState<SwitchedToEmptyGroup | null>(
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-30 rounded border border-gray-300 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 lg:hidden"
      >
        <MenuIcon />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-sideline-900 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-3 border-b border-white/15 px-5 py-5">
          <BasketballIcon />
          <span className="text-2xl font-bold">{APP_NAME}</span>
        </div>

        <nav className="flex flex-col gap-1 border-b border-white/15 px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm font-semibold ${active ? "bg-ball-500/20 text-ball-300 shadow-[inset_3px_0_0_var(--color-ball-500)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-2">
          <UserMenu
            userName={userName}
            isSuperAdmin={isSuperAdmin}
            onNavigate={() => setOpen(false)}
            groups={groups}
            activeGroupId={activeGroupId}
            onJoinGroup={() => {
              setOpen(false);
              setJoining(true);
            }}
            onSwitchedToEmptyGroup={(prompt) => {
              setOpen(false);
              setCopyPrompt(prompt);
            }}
          />
        </div>
      </aside>

      {/* Rendered outside the aside: its transform would otherwise contain
          the modal's fixed positioning on small screens. */}
      {joining && (
        <GroupPickerModal
          groups={joinableGroups}
          userGroups={groups}
          activeGroupId={activeGroupId}
          onClose={() => setJoining(false)}
        />
      )}
      {copyPrompt && (
        <CopyPicksModal
          groupId={copyPrompt.group.id}
          groupName={copyPrompt.group.name}
          sources={copyPrompt.sources}
          defaultSourceId={copyPrompt.previousGroupId}
          onClose={() => setCopyPrompt(null)}
        />
      )}
    </>
  );
};

type SwitchedToEmptyGroup = {
  group: UserGroup;
  sources: PickSource[];
  previousGroupId: string | null;
};

const UserMenu = ({
  userName,
  isSuperAdmin,
  onNavigate,
  groups,
  activeGroupId,
  onJoinGroup,
  onSwitchedToEmptyGroup,
}: {
  userName: string;
  isSuperAdmin: boolean;
  // Closes the mobile sidebar after following a link.
  onNavigate: () => void;
  groups: UserGroup[];
  activeGroupId: string | null;
  onJoinGroup: () => void;
  // Called when the user has no picks in the group they switched to but has
  // a bracket in another group they could copy.
  onSwitchedToEmptyGroup: (prompt: SwitchedToEmptyGroup) => void;
}) => {
  const router = useRouter();
  const settingsActive = isActivePath(usePathname(), "/settings");
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = groupLabel(groups.find((group) => group.id === activeGroupId));
  const busy = signingOut || switchingId !== null;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSwitch(groupId: string) {
    if (busy) return;
    if (groupId === activeGroupId) {
      setOpen(false);
      return;
    }
    setSwitchingId(groupId);
    setError(null);
    try {
      const response = await fetch("/api/groups/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not switch group");
      const { group, picksFrom }: { group: UserGroup; picksFrom: PickSource[] } =
        body;
      setOpen(false);
      router.refresh();
      if (picksFrom.length)
        onSwitchedToEmptyGroup({
          group,
          sources: picksFrom,
          previousGroupId: activeGroupId,
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch group");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 bottom-full mb-2 rounded-lg border border-white/15 bg-sideline-800 p-1 shadow-lg"
        >
          <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            Your groups
          </div>
          {groups.length ? (
            <div className="max-h-60 overflow-y-auto">
              {groups.map((group) => {
                const active = group.id === activeGroupId;
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => handleSwitch(group.id)}
                    disabled={busy}
                    className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm disabled:cursor-wait ${active ? "bg-white/10 font-semibold text-white" : "text-white/80 hover:bg-white/10"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {group.name}
                      {group.role === "admin" && (
                        <span className="ml-1 text-xs font-normal text-white/50">
                          admin
                        </span>
                      )}
                    </span>
                    {switchingId === group.id ? (
                      <span className="text-xs text-white/60">...</span>
                    ) : (
                      active && <CheckIcon />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-2 text-sm text-white/60">No groups yet</p>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onJoinGroup();
            }}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            <PlusIcon />
            Join another group
          </button>
          {error && (
            <p role="alert" className="px-3 py-1 text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="my-1 border-t border-white/15" />
          {isSuperAdmin && (
            <Link
              href="/settings"
              role="menuitem"
              aria-current={settingsActive ? "page" : undefined}
              onClick={() => {
                setOpen(false);
                onNavigate();
              }}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold ${settingsActive ? "bg-ball-500/20 text-ball-300 shadow-[inset_3px_0_0_var(--color-ball-500)]" : "text-white/90 hover:bg-white/10"}`}
            >
              <SettingsIcon />
              Settings
              {settingsActive && <CheckIcon />}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={busy}
            className="w-full rounded px-3 py-2 text-left text-sm font-semibold text-white/90 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-lg border border-white/15 bg-white/10 px-3 py-3 text-left hover:bg-white/15"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ball-500 text-sm font-semibold">
          {initials(userName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {userName}
          </span>
          <span className="block truncate text-xs text-white/70" title={label}>
            {label}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>
    </div>
  );
};

function BasketballIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-ball-500" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5v19M5.3 5.3c3.2 3.2 3.2 10.2 0 13.4M18.7 5.3c-3.2 3.2-3.2 10.2 0 13.4" />
    </svg>
  );
}

function BracketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M3 5h5v6H3M3 13h5v6H3M8 8h4v8H8M12 12h5M21 9v6h-4V9z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
