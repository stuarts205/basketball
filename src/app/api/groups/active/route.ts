import { auth } from "@/lib/auth";
import {
  UUID_PATTERN,
  findUserGroup,
  pickSourcesFor,
  setActiveGroupCookies,
} from "@/lib/groups";
import { cookies } from "next/headers";

// Switches the signed-in user's active group to one they already belong to.
// picksFrom lists the user's other brackets when the new group has none, so
// the client can offer to copy one.
export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to switch groups" },
        { status: 401 },
      );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    const groupId =
      body && typeof body === "object" && "groupId" in body && typeof body.groupId === "string"
        ? body.groupId
        : "";

    const group = UUID_PATTERN.test(groupId)
      ? await findUserGroup(session.user.id, groupId)
      : null;
    if (!group)
      return Response.json(
        { error: "You are not a member of that group" },
        { status: 404 },
      );

    setActiveGroupCookies(await cookies(), group.id, session.session.id);
    const picksFrom = await pickSourcesFor(session.user.id, group.id);
    return Response.json({ group, picksFrom });
  } catch (error) {
    console.error("Could not switch group", error);
    return Response.json({ error: "Could not switch group" }, { status: 500 });
  }
}
