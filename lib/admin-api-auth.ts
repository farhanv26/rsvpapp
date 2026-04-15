import "server-only";

import { cookies } from "next/headers";
import { COOKIE_NAME, readAdminSessionToken } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function getCurrentAdminUserFromApi() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const session = await readAdminSessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!user?.active) return null;
    return { id: user.id, name: user.name, role: user.role };
  } catch {
    return null;
  }
}
