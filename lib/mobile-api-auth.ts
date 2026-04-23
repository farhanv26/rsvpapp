import "server-only";

import type { NextRequest } from "next/server";
import { readAdminSessionToken } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

/**
 * Extracts and validates a mobile API request's Bearer token.
 * Same JWT format and secret as the web cookie session — no separate auth system.
 */
export async function getMobileAdminUser(req: NextRequest) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;
  try {
    const session = await readAdminSessionToken(token);
    const user = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      select: { id: true, name: true, role: true, active: true },
    });
    if (!user?.active) return null;
    return { id: user.id, name: user.name, role: user.role as "super_admin" | "event_creator" };
  } catch {
    return null;
  }
}

export function isMobileSuperAdmin(user: { role: string }) {
  return user.role === "super_admin";
}

/** Standard 401 response for unauthenticated mobile requests. */
export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** Standard 403 response for forbidden mobile requests. */
export function forbiddenResponse() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

/** Standard 404 response. */
export function notFoundResponse(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}
