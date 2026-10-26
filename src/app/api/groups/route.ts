import { auth } from "@/lib/auth";
import {
  createGroup,
  listGroups,
  parseCopyPicksFrom,
  parsePin,
  setActiveGroupCookies,
} from "@/lib/groups";
import { GROUP_NAME_MAX_LENGTH } from "@/lib/types";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json({ error: "Sign in to view groups" }, { status: 401 });

    return Response.json({ groups: await listGroups() });
  } catch (error) {
    console.error("Could not list groups", error);
    return Response.json({ error: "Could not load groups" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to create a group" },
        { status: 401 },
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
    if (!name || name.length > GROUP_NAME_MAX_LENGTH) {
      return Response.json(
        {
          error: `Group name must be 1-${GROUP_NAME_MAX_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    const copyPicksFrom = parseCopyPicksFrom(body);
    if (copyPicksFrom === null)
      return Response.json(
        { error: "copyPicksFrom must be a group ID" },
        { status: 400 },
      );

    // Private groups need a PIN that the admin shares with people they invite.
    const isPrivate =
      body && typeof body === "object" && "isPrivate" in body
        ? body.isPrivate
        : false;
    if (typeof isPrivate !== "boolean")
      return Response.json(
        { error: "isPrivate must be true or false" },
        { status: 400 },
      );
    const pin = isPrivate ? parsePin(body) : undefined;
    if (isPrivate && !pin)
      return Response.json(
        { error: "Private groups need a PIN of 4-8 digits" },
        { status: 400 },
      );

    const group = await createGroup(
      session.user.id,
      name,
      copyPicksFrom,
      pin ?? undefined,
    );
    if (!group)
      return Response.json(
        { error: "A group with that name already exists" },
        { status: 409 },
      );

    setActiveGroupCookies(await cookies(), group.id, session.session.id);
    return Response.json({ group }, { status: 201 });
  } catch (error) {
    console.error("Could not create group", error);
    return Response.json({ error: "Could not create group" }, { status: 500 });
  }
}
