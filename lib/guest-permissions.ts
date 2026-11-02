import type { Prisma } from "@prisma/client";

/**
 * Event-level guest-list permissions inside a shared wedding.
 *
 * Compatibility: an event with no EventRole rows behaves exactly as before — every wedding
 * member is an organizer. Only an explicit "contributor" row narrows what someone can do, and
 * only for guests (budgets, vendors and wedding settings follow wedding membership instead).
 */
export type GuestListPermission = {
  actorId: string;
  level: "organizer" | "contributor";
  /** Explicit grant for a contributor to edit every household on the event. */
  canManageAllGuests: boolean;
  allocation: { id: string; places: number } | null;
  rolesConfigured: boolean;
};

export type PlacesGuest = { maxGuests: number; menCount: number | null; womenCount: number | null; kidsCount: number | null };

/** Places an invitation consumes: its full capacity, including children and reserved plus-ones. */
export function invitationPlaces(g: PlacesGuest): number {
  const people = Math.max(g.menCount ?? 0, 0) + Math.max(g.womenCount ?? 0, 0) + Math.max(g.kidsCount ?? 0, 0);
  return Math.max(g.maxGuests ?? 0, people, 0);
}

export function isOrganizer(perm: GuestListPermission): boolean {
  return perm.level === "organizer";
}

export function canSeeAllGuests(perm: GuestListPermission): boolean {
  return perm.level === "organizer" || perm.canManageAllGuests;
}

export function canEditGuest(perm: GuestListPermission, guest: { managedByUserId: string | null }): boolean {
  return canSeeAllGuests(perm) || guest.managedByUserId === perm.actorId;
}

/** Narrowing filter to AND into every guest query for this event. */
export function guestScopeWhere(perm: GuestListPermission): Prisma.GuestWhereInput {
  return canSeeAllGuests(perm) ? {} : { managedByUserId: perm.actorId };
}

export type AllowanceSummary = { places: number; used: number; remaining: number };

export function summarizeAllowance(places: number, used: number): AllowanceSummary {
  return { places, used, remaining: Math.max(places - used, 0) };
}

export class GuestListPermissionError extends Error {
  constructor(
    message: string,
    readonly code: "not_organizer" | "not_your_guest" | "no_allowance" | "allowance_exceeded" | "duplicate_household" | "below_usage",
    readonly details: Record<string, number | string> = {},
  ) {
    super(message);
    this.name = "GuestListPermissionError";
  }
}
