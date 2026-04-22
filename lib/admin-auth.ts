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
    const row = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!row || !row.active) {
      redirect("/admin/login");
    }
    return { id: row.id, name: row.name, role: row.role };
  } catch {
    redirect("/admin/login");
  }
}

/** Returns the current admin user if logged in, or null (no redirect). Used for RSVP preview mode. */
export async function getOptionalAdminUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  try {
    const session = await readAdminSessionToken(token);
    const row = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!row || !row.active) {
      return null;
    }
    return { id: row.id, name: row.name, role: row.role };
  } catch {
    return null;
  }
}

export function isSuperAdmin(user: { role: string }) {
  return user.role === "super_admin";
}

export async function requireSuperAdmin() {
  const user = await requireCurrentAdminUser();
  if (!isSuperAdmin(user)) {
    redirect("/admin/events?error=forbidden");
  }
  return user;
}
