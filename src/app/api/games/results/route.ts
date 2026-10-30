import { auth } from "@/lib/auth";
import { resetActualResults, saveActualResults } from "@/lib/results";

// The tournament's actual winners, shared by every group. Only the super
// admin can set them. PUT body: { winners: { [gameId]: teamName } }.
async function requireSuperAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Sign in to save results" },
      { status: 401 },
    );
  if (!session.user.isSuperAdmin)
    return Response.json(
      { error: "Only the super admin can save results" },
      { status: 403 },
    );
  return null;
}

export async function PUT(request: Request) {
  try {
    const denied = await requireSuperAdmin(request);
    if (denied) return denied;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    const winners =
      body && typeof body === "object" && "winners" in body
        ? body.winners
        : undefined;
    if (
      !winners ||
      typeof winners !== "object" ||
      Array.isArray(winners) ||
      Object.values(winners).some((name) => typeof name !== "string")
    ) {
      return Response.json(
        { error: "winners must map game IDs to team names" },
        { status: 400 },
      );
    }

    const saved = await saveActualResults(winners as Record<string, string>);
    return Response.json({ saved });
  } catch (error) {
    console.error("Could not save results", error);
    return Response.json({ error: "Could not save results" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireSuperAdmin(request);
    if (denied) return denied;
    await resetActualResults();
    return Response.json({ cleared: true });
  } catch (error) {
    console.error("Could not clear results", error);
    return Response.json({ error: "Could not clear results" }, { status: 500 });
  }
}
