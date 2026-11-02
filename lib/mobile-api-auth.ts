import "server-only";

import type { NextRequest } from "next/server";
import { readAdminSessionToken } from "@/lib/admin-session";
import { prisma, withReconnect } from "@/lib/prisma";
import { getEventAccess, type AccessibleEvent } from "@/lib/wedding-access";
import type { Prisma } from "@prisma/client";
import { getGuestListPermission } from "@/lib/guest-allocation";
import { GuestListPermissionError, guestScopeWhere, type GuestListPermission } from "@/lib/guest-permissions";

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

/**
 * Workspace-scoped authorization for `/events/[eventId]/…` mobile routes.
 * Keeps the existing status codes: 404 when the event is missing, 403 when the user lacks access.
 */
export async function authorizeMobileEvent(
  user: { id: string; role: string },
  eventId: string,
  options: { state?: "active" | "deleted"; notFoundMessage?: string; organizerOnly?: boolean } = {},
): Promise<
  | { event: AccessibleEvent; perm: GuestListPermission; guestScope: Prisma.GuestWhereInput; error?: undefined }
  | { event?: undefined; perm?: undefined; guestScope?: undefined; error: Response }
> {
  const access = await withReconnect(() => getEventAccess(user, eventId, { state: options.state }));
  if (access.status === "not_found") {
    return { error: notFoundResponse(options.notFoundMessage ?? "Event not found") };
  }
  if (access.status === "forbidden") {
    return { error: forbiddenResponse() };
  }
  const perm = await getGuestListPermission(user, eventId);
  if (options.organizerOnly && perm.level !== "organizer") {
    return { error: Response.json({ error: "Only this event's organizers can do that.", code: "not_organizer" }, { status: 403 }) };
  }
  return { event: access.event, perm, guestScope: guestScopeWhere(perm) };
}

/** JSON error for guest-list rule violations (allowance, ownership, duplicates). */
export function guestListErrorResponse(error: unknown): Response | null {
  if (!(error instanceof GuestListPermissionError)) return null;
  const status = error.code === "not_organizer" || error.code === "not_your_guest" ? 403 : 409;
  return Response.json({ error: error.message, code: error.code, ...error.details }, { status });
}
