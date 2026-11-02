import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GuestListPermissionError,
  invitationPlaces,
  type GuestListPermission,
  type PlacesGuest,
} from "@/lib/guest-permissions";
import { isPlatformSuperAdmin, type AccessActor } from "@/lib/wedding-policy";

type Db = PrismaClient | Prisma.TransactionClient;

/** Caller must already have passed the wedding/event access check (getEventAccess). */
export async function getGuestListPermission(actor: AccessActor, eventId: string, db: Db = prisma): Promise<GuestListPermission> {
  const [roleCount, myRole, myAllocation] = await Promise.all([
    db.eventRole.count({ where: { eventId } }),
    db.eventRole.findUnique({ where: { eventId_userId: { eventId, userId: actor.id } }, select: { role: true, canManageAllGuests: true } }),
    db.eventAllocation.findUnique({ where: { eventId_userId: { eventId, userId: actor.id } }, select: { id: true, places: true } }),
  ]);
  const contributor = !isPlatformSuperAdmin(actor) && myRole?.role === "contributor";
  return {
    actorId: actor.id,
    level: contributor ? "contributor" : "organizer",
    canManageAllGuests: contributor ? Boolean(myRole?.canManageAllGuests) : true,
    allocation: myAllocation,
    rolesConfigured: roleCount > 0,
  };
}

export function requireOrganizer(perm: GuestListPermission) {
  if (perm.level !== "organizer") {
    throw new GuestListPermissionError("Only this event's organizers can do that.", "not_organizer");
  }
}

/**
 * Locks the allocation row (SELECT … FOR UPDATE) for the rest of the transaction and returns its
 * limit and current usage. Every write that adds places to an allocation goes through here, so
 * concurrent requests against the same allowance are serialized.
 */
export async function lockAllocation(
  tx: Prisma.TransactionClient,
  allocationId: string,
  excludeGuestIds: string[] = [],
): Promise<{ places: number; used: number }> {
  const rows = await tx.$queryRaw<{ places: number }[]>`
    SELECT "places" FROM "EventAllocation" WHERE "id" = ${allocationId} FOR UPDATE`;
  if (rows.length === 0) {
    throw new GuestListPermissionError("That guest allowance no longer exists.", "no_allowance");
  }
  const usage = await tx.$queryRaw<{ used: bigint | number }[]>`
    SELECT COALESCE(SUM(GREATEST("maxGuests", "menCount" + "womenCount" + "kidsCount")), 0)::bigint AS used
    FROM "Guest"
    WHERE "allocationId" = ${allocationId} AND "deletedAt" IS NULL AND NOT ("id" = ANY(${excludeGuestIds}::text[]))`;
  return { places: Number(rows[0]!.places), used: Number(usage[0]?.used ?? 0) };
}

/** Throws unless `additional` more places fit in the allowance. Must run inside a transaction. */
export async function assertAllocationFits(
  tx: Prisma.TransactionClient,
  allocationId: string,
  additional: number,
  excludeGuestIds: string[] = [],
) {
  const { places, used } = await lockAllocation(tx, allocationId, excludeGuestIds);
  if (used + additional > places) {
    const remaining = Math.max(places - used, 0);
    throw new GuestListPermissionError(
      remaining === 0
        ? `Your allowance of ${places} is used up. Ask the organizer for more places.`
        : `Only ${remaining} of your ${places} places are left; this needs ${additional}.`,
      "allowance_exceeded",
      { places, used, remaining, requested: additional },
    );
  }
}

/** Who manages a new household and which allowance it is charged to. */
export function newGuestOwnership(perm: GuestListPermission): { managedByUserId: string; allocationId: string | null } {
  if (perm.level === "contributor" && !perm.allocation) {
    throw new GuestListPermissionError(
      "You don't have a guest allowance for this event yet. Ask the organizer to set one.",
      "no_allowance",
    );
  }
  return { managedByUserId: perm.actorId, allocationId: perm.allocation?.id ?? null };
}

/** Prevents the same household being invited twice to one event once guest lists are split. */
export async function assertNoDuplicateHousehold(db: Db, perm: GuestListPermission, eventId: string, sharedGuestKey: string | null, excludeGuestId?: string) {
  if (!perm.rolesConfigured || !sharedGuestKey) return;
  const existing = await db.guest.findFirst({
    where: { eventId, sharedGuestKey, deletedAt: null, ...(excludeGuestId ? { id: { not: excludeGuestId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new GuestListPermissionError("This household is already on this event's guest list.", "duplicate_household");
  }
}

export function placesOf(g: PlacesGuest) {
  return invitationPlaces(g);
}

export async function allocationUsage(eventId: string) {
  const allocations = await prisma.eventAllocation.findMany({
    where: { eventId },
    select: { id: true, userId: true, places: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const guests = await prisma.guest.findMany({
    where: { eventId, deletedAt: null },
    select: { allocationId: true, managedByUserId: true, maxGuests: true, menCount: true, womenCount: true, kidsCount: true, attending: true },
  });
  const usedBy = new Map<string, { used: number; declinedPlaces: number; households: number }>();
  let unallocated = 0;
  for (const g of guests) {
    const p = invitationPlaces(g);
    if (!g.allocationId) {
      unallocated += p;
      continue;
    }
    const e = usedBy.get(g.allocationId) ?? { used: 0, declinedPlaces: 0, households: 0 };
    e.used += p;
    e.households += 1;
    if (g.attending === false) e.declinedPlaces += p;
    usedBy.set(g.allocationId, e);
  }
  return {
    unallocatedPlaces: unallocated,
    allocations: allocations.map((a) => {
      const u = usedBy.get(a.id) ?? { used: 0, declinedPlaces: 0, households: 0 };
      return { ...a, userName: a.user.name, used: u.used, remaining: Math.max(a.places - u.used, 0), declinedPlaces: u.declinedPlaces, households: u.households };
    }),
  };
}
