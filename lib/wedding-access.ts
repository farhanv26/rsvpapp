import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WEDDING_COOKIE,
  accessibleEventsWhere,
  canAccessEventRecord,
  canAccessWedding,
  canManageWeddingMembers,
  isPlatformSuperAdmin,
  parseWeddingRole,
  resolveActiveWorkspaceScope,
  type AccessActor,
  type ActiveWorkspaceScope,
  type WeddingRole,
  type WorkspaceOption,
} from "@/lib/wedding-policy";

export type AccessibleEvent = {
  id: string;
  title: string;
  ownerUserId: string | null;
  weddingId: string | null;
  membershipRole: WeddingRole | null;
};

export type EventAccessResult =
  | { status: "ok"; event: AccessibleEvent }
  | { status: "not_found" }
  | { status: "forbidden" };

/**
 * Loads an event and checks the actor's access in one query.
 * `state: "deleted"` is used by restore flows; everything else targets active events.
 */
export async function getEventAccess(
  actor: AccessActor,
  eventId: string,
  options: { state?: "active" | "deleted" } = {},
): Promise<EventAccessResult> {
  if (!eventId) return { status: "not_found" };
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: options.state === "deleted" ? { not: null } : null },
    select: {
      id: true,
      title: true,
      ownerUserId: true,
      weddingId: true,
      wedding: {
        select: {
          memberships: { where: { userId: actor.id }, select: { role: true }, take: 1 },
        },
      },
    },
  });
  if (!event) return { status: "not_found" };
  const membershipRole = parseWeddingRole(event.wedding?.memberships[0]?.role);
  if (!canAccessEventRecord(actor, event, membershipRole)) return { status: "forbidden" };
  return {
    status: "ok",
    event: {
      id: event.id,
      title: event.title,
      ownerUserId: event.ownerUserId,
      weddingId: event.weddingId,
      membershipRole,
    },
  };
}

export async function canActorAccessEvent(actor: AccessActor, eventId: string): Promise<boolean> {
  return (await getEventAccess(actor, eventId)).status === "ok";
}

export async function getWeddingMembershipRole(actor: AccessActor, weddingId: string): Promise<WeddingRole | null> {
  const row = await prisma.weddingMembership.findUnique({
    where: { weddingId_userId: { weddingId, userId: actor.id } },
    select: { role: true },
  });
  return parseWeddingRole(row?.role);
}

export type WeddingAccessResult =
  | { status: "ok"; wedding: { id: string; name: string }; membershipRole: WeddingRole | null }
  | { status: "not_found" }
  | { status: "forbidden" };

export async function getWeddingAccess(
  actor: AccessActor,
  weddingId: string,
  options: { require?: "member" | "owner" } = {},
): Promise<WeddingAccessResult> {
  if (!weddingId) return { status: "not_found" };
  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: {
      id: true,
      name: true,
      memberships: { where: { userId: actor.id }, select: { role: true }, take: 1 },
    },
  });
  if (!wedding) return { status: "not_found" };
  const membershipRole = parseWeddingRole(wedding.memberships[0]?.role);
  const allowed =
    options.require === "owner"
      ? canManageWeddingMembers(actor, membershipRole)
      : canAccessWedding(actor, membershipRole);
  if (!allowed) return { status: "forbidden" };
  return { status: "ok", wedding: { id: wedding.id, name: wedding.name }, membershipRole };
}

/** Weddings the actor can switch to. Super admins see every wedding (role is their own membership, if any). */
export async function listWorkspaceOptions(actor: AccessActor): Promise<WorkspaceOption[]> {
  if (isPlatformSuperAdmin(actor)) {
    const rows = await prisma.wedding.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        memberships: { where: { userId: actor.id }, select: { role: true }, take: 1 },
      },
    });
    return rows.map((w) => ({ id: w.id, name: w.name, role: parseWeddingRole(w.memberships[0]?.role) }));
  }
  const rows = await prisma.weddingMembership.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, wedding: { select: { id: true, name: true } } },
  });
  return rows.map((m) => ({ id: m.wedding.id, name: m.wedding.name, role: parseWeddingRole(m.role) }));
}

export async function hasUnassignedEvents(actor: AccessActor): Promise<boolean> {
  const count = await prisma.event.count({
    where: {
      weddingId: null,
      deletedAt: null,
      ...(isPlatformSuperAdmin(actor) ? {} : { ownerUserId: actor.id }),
    },
  });
  return count > 0;
}

export type ActiveWorkspace = {
  scope: ActiveWorkspaceScope;
  weddings: WorkspaceOption[];
  hasUnassignedEvents: boolean;
  activeWedding: WorkspaceOption | null;
};

export async function resolveActiveWorkspace(actor: AccessActor): Promise<ActiveWorkspace> {
  const store = await cookies();
  const [weddings, unassigned] = await Promise.all([listWorkspaceOptions(actor), hasUnassignedEvents(actor)]);
  const scope = resolveActiveWorkspaceScope({
    actor,
    cookieValue: store.get(ACTIVE_WEDDING_COOKIE)?.value,
    weddings,
    hasUnassignedEvents: unassigned,
  });
  const activeWedding = scope.kind === "wedding" ? weddings.find((w) => w.id === scope.weddingId) ?? null : null;
  return { scope, weddings, hasUnassignedEvents: unassigned, activeWedding };
}

/** IDs of every event (including soft-deleted) the actor may access; null means "no restriction" (super admin). */
export async function listAccessibleEventIds(actor: AccessActor): Promise<string[] | null> {
  if (isPlatformSuperAdmin(actor)) return null;
  const rows = await prisma.event.findMany({
    where: accessibleEventsWhere(actor),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
