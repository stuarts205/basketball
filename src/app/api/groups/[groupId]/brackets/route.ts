import { auth } from "@/lib/auth";
import {
  createBracket,
  deleteBracket,
  parseBracketNumber,
} from "@/lib/brackets";
import { UUID_PATTERN } from "@/lib/groups";
import { BRACKET_NAME_MAX_LENGTH, MAX_BRACKETS } from "@/lib/types";

// Adds an empty, named bracket for the signed-in user in this group, up to
// MAX_BRACKETS. Body: { name, first? }; `first: true` names their first
// bracket instead.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to add a bracket" },
        { status: 401 },
      );
    if (session.user.isSuperAdmin)
      return Response.json(
        { error: "The super admin doesn't make picks" },
        { status: 403 },
      );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    const name =
      body && typeof body === "object" && "name" in body && typeof body.name === "string"
        ? body.name.trim()
        : "";
    if (!name || name.length > BRACKET_NAME_MAX_LENGTH) {
      return Response.json(
        {
          error: `Bracket name must be 1-${BRACKET_NAME_MAX_LENGTH} characters`,
        },
        { status: 400 },
      );
    }
    const { groupId } = await params;
    if (!UUID_PATTERN.test(groupId))
      return Response.json({ error: "Invalid group" }, { status: 400 });

    const first =
      !!body && typeof body === "object" && "first" in body && body.first === true;
    const result = await createBracket(session.user.id, groupId, name, {
      first,
    });
    if (result === "exists")
      return Response.json(
        { error: "Your first bracket already has a name" },
        { status: 409 },
      );
    if (result === "not-member")
      return Response.json(
        { error: "You are not a member of that group" },
        { status: 404 },
      );
    if (result === "full")
      return Response.json(
        { error: `You already have ${MAX_BRACKETS} brackets in this group` },
        { status: 409 },
      );
    return Response.json({ bracket: result }, { status: 201 });
  } catch (error) {
    console.error("Could not add a bracket", error);
    return Response.json({ error: "Could not add a bracket" }, { status: 500 });
  }
}

// Deletes one of the signed-in user's brackets in this group, with all its
// picks. Later brackets move up a number. Query: ?number=1..MAX_BRACKETS.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to delete a bracket" },
        { status: 401 },
      );
    if (session.user.isSuperAdmin)
      return Response.json(
        { error: "The super admin doesn't make picks" },
        { status: 403 },
      );

    const { groupId } = await params;
    const rawNumber = new URL(request.url).searchParams.get("number");
    const number = rawNumber ? parseBracketNumber(rawNumber) : null;
    if (!UUID_PATTERN.test(groupId) || !number)
      return Response.json(
        { error: "A group and bracket number are required" },
        { status: 400 },
      );

    const result = await deleteBracket(session.user.id, groupId, number);
    if (result === "not-member")
      return Response.json(
        { error: "You are not a member of that group" },
        { status: 404 },
      );
    if (result === "not-found")
      return Response.json(
        { error: "You don't have that bracket in this group" },
        { status: 404 },
      );
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("Could not delete a bracket", error);
    return Response.json(
      { error: "Could not delete the bracket" },
      { status: 500 },
    );
  }
}
