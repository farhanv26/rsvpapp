import { prisma } from "@/lib/prisma";

/** GET /admin/api/mobile/auth/users — list active admin usernames for the login picker. No auth required. */
export async function GET() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return Response.json({ users: users.map((u) => u.name) });
}
