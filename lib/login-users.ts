import "server-only";

import { prisma } from "@/lib/prisma";

export async function getActiveUsersForLogin() {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { name: true, role: true },
  });
}
