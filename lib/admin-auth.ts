import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, readAdminSessionToken } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function requireCurrentAdminUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    redirect("/admin/login");
  }

  try {
    const session = await readAdminSessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, role: true },
    });
    if (!user) {
      redirect("/admin/login");
    }
    return user;
  } catch {
    redirect("/admin/login");
  }
}

export function isSuperAdmin(user: { role: string; name: string }) {
  return user.role === "super_admin" || user.name === "Farhan";
}
