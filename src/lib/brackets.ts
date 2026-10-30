import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brackets, picks, user } from "@/db/schema";
import { findUserGroup } from "@/lib/groups";
import {
  BracketSummary,
  DEFAULT_BRACKET_NAME,
  MAX_BRACKETS,
} from "@/lib/types";

export { DEFAULT_BRACKET_NAME };

// The user's brackets in a group, in order. Bracket 1 is listed even before
// it has been named.
export async function listBrackets(
  userId: string,
  groupId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<BracketSummary[]> {
  const rows = await database
    .select({ number: brackets.number, name: brackets.name })
    .from(brackets)
    .where(and(eq(brackets.userId, userId), eq(brackets.groupId, groupId)))
    .orderBy(asc(brackets.number));
  return [
    rows.find((row) => row.number === 1) ?? {
      number: 1,
      name: DEFAULT_BRACKET_NAME,
    },
    ...rows.filter((row) => row.number !== 1),
  ];
}

// Reads a bracket number from a request value. Defaults to bracket 1 when it
// is missing; returns null when it is not 1 to MAX_BRACKETS.
export function parseBracketNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 1;
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" &&
    Number.isInteger(number) &&
    number >= 1 &&
    number <= MAX_BRACKETS
    ? number
    : null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Whether the user has this bracket in the group (bracket 1 always counts).
export async function hasBracket(
  userId: string,
  groupId: string,
  number: number,
  database: Pick<typeof db, "select"> | Transaction = db,
): Promise<boolean> {
  return (await listBrackets(userId, groupId, database)).some(
    (bracket) => bracket.number === number,
  );
}

// Deletes one of the user's brackets in the group with all its picks.
// Brackets after it move up a number, keeping their names and picks, so the
// first bracket is always number 1. Deleting the only bracket leaves the
// user with an unnamed, empty first bracket.
export async function deleteBracket(
  userId: string,
  groupId: string,
  number: number,
  database: Pick<typeof db, "transaction"> = db,
): Promise<"deleted" | "not-member" | "not-found"> {
  return database.transaction(async (tx) => {
    // Serialize with the user's other bracket and pick edits.
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!(await findUserGroup(userId, groupId, tx))) return "not-member";
    if (!(await hasBracket(userId, groupId, number, tx))) return "not-found";
    const ownPicks = and(eq(picks.userId, userId), eq(picks.groupId, groupId));
    const ownBrackets = and(
      eq(brackets.userId, userId),
      eq(brackets.groupId, groupId),
    );
    await tx
      .delete(picks)
      .where(and(ownPicks, eq(picks.bracketNumber, number)));
    await tx
      .delete(brackets)
      .where(and(ownBrackets, eq(brackets.number, number)));
    // One number at a time, lowest first, so no two brackets ever share one.
    for (let next = number + 1; next <= MAX_BRACKETS; next++) {
      await tx
        .update(picks)
        .set({ bracketNumber: next - 1 })
        .where(and(ownPicks, eq(picks.bracketNumber, next)));
      await tx
        .update(brackets)
        .set({ number: next - 1 })
        .where(and(ownBrackets, eq(brackets.number, next)));
    }
    return "deleted";
  });
}

// Whether the user has named any bracket in the group yet.
export async function hasNamedBracket(
  userId: string,
  groupId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<boolean> {
  const [row] = await database
    .select({ number: brackets.number })
    .from(brackets)
    .where(and(eq(brackets.userId, userId), eq(brackets.groupId, groupId)))
    .limit(1);
  return Boolean(row);
}

// Adds the user's next empty bracket in the group under the given name. With
// `first`, names bracket 1 instead, which is refused once it has a name.
export async function createBracket(
  userId: string,
  groupId: string,
  name: string,
  { first = false } = {},
  database: Pick<typeof db, "transaction"> = db,
): Promise<BracketSummary | "not-member" | "full" | "exists"> {
  return database.transaction(async (tx) => {
    // Serialize with the user's other bracket and pick edits.
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!(await findUserGroup(userId, groupId, tx))) return "not-member";
    if (first) {
      const [named] = await tx
        .insert(brackets)
        .values({ groupId, userId, number: 1, name })
        .onConflictDoNothing()
        .returning({ number: brackets.number, name: brackets.name });
      return named ?? "exists";
    }
    const taken = new Set(
      (await listBrackets(userId, groupId, tx)).map((bracket) => bracket.number),
    );
    const number = Array.from({ length: MAX_BRACKETS }, (_, i) => i + 1).find(
      (candidate) => !taken.has(candidate),
    );
    if (!number) return "full";
    await tx.insert(brackets).values({ groupId, userId, number, name });
    return { number, name };
  });
}
