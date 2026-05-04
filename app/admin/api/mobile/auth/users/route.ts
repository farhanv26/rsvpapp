import { prisma, withReconnect } from "@/lib/prisma";

/** GET /admin/api/mobile/auth/users — list active admin usernames for the login picker. No auth required. */
export async function GET() {
  try {
    const users = await withReconnect(() =>
      prisma.user.findMany({
        where: { deletedAt: null, active: true },
        select: { name: true },
        orderBy: { name: "asc" },
      })
    );
    return Response.json({ users: users.map((u) => u.name) });
  } catch (err) {
    console.error("[mobile/auth/users GET]", err);
    return Response.json({ error: "Failed to load users" }, { status: 500 });
  }
}
