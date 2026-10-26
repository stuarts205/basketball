import { auth } from "@/lib/auth";
import { UUID_PATTERN, copyPicksIntoEmptyGroup } from "@/lib/groups";

// Starts the signed-in user's empty bracket in this group as a copy of their
// bracket in another group. Body: { copyFrom: groupId }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json({ error: "Sign in to copy picks" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    const copyFrom =
      body && typeof body === "object" && "copyFrom" in body && typeof body.copyFrom === "string"
        ? body.copyFrom
        : "";
    const { groupId } = await params;
    if (!UUID_PATTERN.test(groupId) || !UUID_PATTERN.test(copyFrom))
      return Response.json(
        { error: "copyFrom must be a group ID" },
        { status: 400 },
      );

    const result = await copyPicksIntoEmptyGroup(
      session.user.id,
      copyFrom,
      groupId,
    );
    if (result === "not-member")
      return Response.json(
        { error: "You are not a member of that group" },
        { status: 404 },
      );
    if (result === "not-empty")
      return Response.json(
        { error: "You already have picks in this group" },
        { status: 409 },
      );
    if (result === "no-source")
      return Response.json(
        { error: "No picks to copy from that group" },
        { status: 404 },
      );
    return Response.json({ copied: true });
  } catch (error) {
    console.error("Could not copy picks", error);
    return Response.json({ error: "Could not copy picks" }, { status: 500 });
  }
}
