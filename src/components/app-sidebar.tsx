"use client";
import { CopyPicksModal } from "@/components/copy-picks-modal";
import { GroupPickerModal } from "@/components/group-picker-modal";
import { NewBracketModal } from "@/components/new-bracket-modal";
import { BracketConfirmModal } from "@/components/bracket-confirm-modal";
import { ResetDataModal } from "@/components/reset-data-modal";
import { authClient } from "@/lib/auth-client";
import {
  BracketSummary,
  GroupSummary,
  MAX_BRACKETS,
  PickSource,
  SIDEBAR_COOKIE,
  UserGroup,
} from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  brackets,
  initialCollapsed,
}: {
  userName: string;
  isSuperAdmin: boolean;
  groups: UserGroup[];
  activeGroupId: string | null;
  joinableGroups: GroupSummary[];
  // The user's brackets in the active group.
  brackets: BracketSummary[];
  // Whether the desktop sidebar starts collapsed, from SIDEBAR_COOKIE.
  initialCollapsed: boolean;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Matches the bracket page: an unknown or missing ?b= shows bracket 1.
  const activeBracketNumber =
    brackets.find((bracket) => String(bracket.number) === searchParams.get("b"))
      ?.number ?? 1;
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const [open, setOpen] = useState(false);
  // On desktop the sidebar can shrink to a strip holding only its toggle.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [joining, setJoining] = useState(false);
  const [addingBracket, setAddingBracket] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  // A bracket the user asked to reset or delete, awaiting confirmation.
  const [confirming, setConfirming] = useState<{
    action: "reset" | "delete";
    bracket: BracketSummary;
  } | null>(null);
  const [copyPrompt, setCopyPrompt] = useState<SwitchedToEmptyGroup | null>(
    null,
  );
  const hiddenWhenCollapsed = collapsed ? "lg:hidden" : "";
  // The super admin has no bracket of their own: theirs shows the results.
  const navItems = isSuperAdmin
    ? NAV_ITEMS.map((item) =>
        item.href === "/bracket" ? { ...item, label: "Bracket" } : item,
      )
    : NAV_ITEMS;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    // Remembered so the next page load renders the same way on the server.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-sideline-900 text-white transition-[transform,width] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-14" : ""}`}
      >
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Show sidebar"
            aria-expanded={false}
            title="Show sidebar"
            className="mx-auto mt-4 hidden rounded p-2 text-white/75 hover:bg-white/10 hover:text-white lg:block"
          >
            <SidebarIcon />
          </button>
        )}

        <div
          className={`flex items-center gap-3 border-b border-white/15 py-5 pl-5 pr-3 ${hiddenWhenCollapsed}`}
        >
          <BasketballIcon />
          <span className="flex-1 text-2xl font-bold">{APP_NAME}</span>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Hide sidebar"
            aria-expanded={true}
            title="Hide sidebar"
            className="hidden shrink-0 rounded p-2 text-white/60 hover:bg-white/10 hover:text-white lg:block"
          >
            <SidebarIcon />
          </button>
        </div>

        <nav
          className={`flex flex-col gap-1 border-b border-white/15 px-3 py-4 ${hiddenWhenCollapsed}`}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            const link = (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2 text-sm font-semibold ${active ? "bg-ball-500/20 text-ball-300 shadow-[inset_3px_0_0_var(--color-ball-500)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon />
                {label}
              </Link>
            );
            if (href !== "/bracket" || !activeGroup || isSuperAdmin)
              return link;
            const full = brackets.length >= MAX_BRACKETS;
            return (
              <div key={href} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  {link}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setAddingBracket(true);
                    }}
                    disabled={full}
                    aria-label="Add a bracket"
                    title={
                      full
                        ? `You can fill out up to ${MAX_BRACKETS} brackets per group`
                        : "Add a bracket"
                    }
                    className="shrink-0 rounded p-2 text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <PlusIcon />
                  </button>
                </div>
                {brackets.length > 0 && (
                  <ul className="flex flex-col gap-0.5 pl-8">
                    {brackets.map((bracket) => {
                      const current =
                        active && bracket.number === activeBracketNumber;
                      return (
                        <li
                          key={bracket.number}
                          className="relative flex items-center gap-1"
                        >
                          <Link
                            href={`/bracket?b=${bracket.number}`}
                            onClick={() => setOpen(false)}
                            aria-current={current ? "page" : undefined}
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded px-3 py-1.5 text-sm ${current ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
                          >
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${current ? "bg-ball-500" : "bg-white/30"}`}
                            />
                            <span className="min-w-0 truncate">
                              {bracket.name}
                            </span>
                          </Link>
                          <BracketMenu
                            name={bracket.name}
                            onChoose={(action) => {
                              setOpen(false);
                              setConfirming({ action, bracket });
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapsed on desktop: just the icons, with names on hover. */}
        {collapsed && (
          <nav className="mt-3 hidden flex-col items-center gap-1 border-t border-white/15 pt-3 lg:flex">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <div key={href} className="flex flex-col items-center gap-1">
                  <Link
                    href={href}
                    aria-label={label.trim()}
                    title={label.trim()}
                    aria-current={active ? "page" : undefined}
                    className={`rounded p-2 ${active ? "bg-ball-500/20 text-ball-300 shadow-[inset_3px_0_0_var(--color-ball-500)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                  >
                    <Icon />
                  </Link>
                  {href === "/bracket" &&
                    brackets.map((bracket) => {
                      const current =
                        active && bracket.number === activeBracketNumber;
                      return (
                        <Link
                          key={bracket.number}
                          href={`/bracket?b=${bracket.number}`}
                          aria-label={bracket.name}
                          title={bracket.name}
                          aria-current={current ? "page" : undefined}
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${current ? "bg-ball-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"}`}
                        >
                          {bracket.number}
                        </Link>
                      );
                    })}
                </div>
              );
            })}
          </nav>
        )}

        <div className={`mt-auto p-2 ${collapsed ? "lg:px-1" : ""}`}>
          <UserMenu
            compact={collapsed}
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
            onResetData={() => {
              setOpen(false);
              setResettingData(true);
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
      {confirming && activeGroup && (
        <BracketConfirmModal
          action={confirming.action}
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          bracket={confirming.bracket}
          viewingNumber={
            isActivePath(pathname, "/bracket") ? activeBracketNumber : null
          }
          onClose={() => setConfirming(null)}
        />
      )}
      {addingBracket && activeGroup && (
        <NewBracketModal
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          bracketNumber={
            Array.from({ length: MAX_BRACKETS }, (_, i) => i + 1).find(
              (number) => !brackets.some((bracket) => bracket.number === number),
            ) ?? MAX_BRACKETS
          }
          onClose={() => setAddingBracket(false)}
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
      {resettingData && (
        <ResetDataModal onClose={() => setResettingData(false)} />
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
  compact,
  userName,
  isSuperAdmin,
  onNavigate,
  groups,
  activeGroupId,
  onJoinGroup,
  onSwitchedToEmptyGroup,
  onResetData,
}: {
  // In the collapsed desktop sidebar: only the avatar shows, and the menu
  // opens to its right.
  compact: boolean;
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
  // Super admin only: asks to wipe every team, game, group, bracket and pick.
  onResetData: () => void;
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
          className={`absolute inset-x-0 bottom-full z-50 mb-2 rounded-lg border border-white/15 bg-sideline-800 p-1 shadow-lg ${compact ? "lg:inset-x-auto lg:bottom-0 lg:left-full lg:mb-0 lg:ml-3 lg:w-60" : ""}`}
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
          {isSuperAdmin && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onResetData();
              }}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-red-300 hover:bg-white/10 disabled:opacity-50"
            >
              <TrashIcon />
              Reset all data
            </button>
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
        aria-label={compact ? `${userName}, ${label}` : undefined}
        title={compact ? `${userName} · ${label}` : undefined}
        className={`flex w-full items-center gap-3 rounded-lg border border-white/15 bg-white/10 px-3 py-3 text-left hover:bg-white/15 ${compact ? "lg:justify-center lg:border-0 lg:bg-transparent lg:p-1 lg:hover:bg-white/10" : ""}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ball-500 text-sm font-semibold">
          {initials(userName)}
        </span>
        <span className={`min-w-0 flex-1 ${compact ? "lg:hidden" : ""}`}>
          <span className="block truncate text-sm font-semibold">
            {userName}
          </span>
          <span className="block truncate text-xs text-white/70" title={label}>
            {label}
          </span>
        </span>
        <span className={compact ? "lg:hidden" : ""}>
          <ChevronIcon open={open} />
        </span>
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

// A panel with its left column marked, for showing and hiding the sidebar.
function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

// The options next to one of the user's brackets: reset its picks or delete
// it. Each is confirmed in a popup before anything changes.
function BracketMenu({
  name,
  onChoose,
}: {
  name: string;
  onChoose: (action: "reset" | "delete") => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const choose = (action: "reset" | "delete") => {
    setOpen(false);
    onChoose(action);
  };

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${name}`}
        title={`Options for ${name}`}
        className="rounded p-1.5 text-white/40 hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white"
      >
        <EllipsisIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/15 bg-sideline-800 p-1 text-sm shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose("reset")}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left font-semibold text-white/90 hover:bg-white/10"
          >
            <ResetIcon />
            Reset picks
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose("delete")}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left font-semibold text-red-300 hover:bg-red-500/15"
          >
            <TrashIcon />
            Delete bracket
          </button>
        </div>
      )}
    </div>
  );
}

function EllipsisIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

// A circular arrow, for resetting a bracket's picks.
function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
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
