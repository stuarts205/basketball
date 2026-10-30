import { db } from "@/db";
import { auth } from "@/lib/auth";
import { sql } from "drizzle-orm";

// Clears the tournament and every group, bracket and pick so the super admin
// can start over. User accounts are kept.
export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return Response.json(
        { error: "Sign in to reset the data" },
        { status: 401 },
      );
    if (!session.user.isSuperAdmin)
      return Response.json(
        { error: "Only the super admin can reset the data" },
        { status: 403 },
      );

    await db.execute(
      sql`truncate brackets, games, group_members, groups, picks, teams restart identity`,
    );
    return Response.json({ reset: true });
  } catch (error) {
    console.error("Could not reset the data", error);
    return Response.json({ error: "Could not reset the data" }, { status: 500 });
  }
}
