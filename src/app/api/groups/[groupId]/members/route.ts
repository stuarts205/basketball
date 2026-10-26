import { auth } from "@/lib/auth";
import {
  ACTIVE_GROUP_COOKIE,
  ACTIVE_GROUP_COOKIE_OPTIONS,
  UUID_PATTERN,
  joinGroup,
  parseCopyPicksFrom,
} from "@/lib/groups";
import { cookies } from "next/headers";

// Joins the signed-in user to the group as a member and makes it their
// active group. Body (optional): { copyPicksFrom?: groupId }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json({ error: "Sign in to join a group" }, { status: 401 });

    // The body is optional; it only carries the copyPicksFrom choice.
    let body: unknown;
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : undefined;
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    const copyPicksFrom = parseCopyPicksFrom(body);
    if (copyPicksFrom === null)
      return Response.json(
        { error: "copyPicksFrom must be a group ID" },
        { status: 400 },
      );

    const { groupId } = await params;
    const group = UUID_PATTERN.test(groupId)
      ? await joinGroup(session.user.id, groupId, copyPicksFrom)
      : null;
    if (!group)
      return Response.json({ error: "Group not found" }, { status: 404 });

    (await cookies()).set(
      ACTIVE_GROUP_COOKIE,
      group.id,
      ACTIVE_GROUP_COOKIE_OPTIONS,
    );
    return Response.json({ group });
  } catch (error) {
    console.error("Could not join group", error);
    return Response.json({ error: "Could not join group" }, { status: 500 });
  }
}
