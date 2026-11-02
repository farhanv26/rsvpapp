import type { Prisma } from "@prisma/client";

export type WeddingRole = "owner" | "member";

export type AccessActor = { id: string; role: string };

export type EventAccessRecord = {
  ownerUserId: string | null;
  weddingId: string | null;
};

export const WEDDING_ROLES: readonly WeddingRole[] = ["owner", "member"] as const;

export function isPlatformSuperAdmin(actor: { role: string }): boolean {
  return actor.role === "super_admin";
}

export function parseWeddingRole(value: unknown): WeddingRole | null {
  return value === "owner" || value === "member" ? value : null;
}

/**
 * Single source of truth for customer access to an event and everything under it
 * (guests, RSVPs, communication logs, activity, reports, previews).
 *
 * - Platform super admins keep full access.
 * - Events assigned to a wedding require a membership in that wedding.
 * - Legacy events not yet assigned by the backfill mapping (weddingId = null) stay
 *   reachable only by their legacy owner, exactly as before this change.
 */
export function canAccessEventRecord(
  actor: AccessActor,
  event: EventAccessRecord,
  membershipRole: WeddingRole | string | null | undefined,
): boolean {
  if (isPlatformSuperAdmin(actor)) return true;
  if (event.weddingId) {
    return parseWeddingRole(membershipRole) !== null;
  }
  return event.ownerUserId !== null && event.ownerUserId === actor.id;
}

export function canAccessWedding(actor: AccessActor, membershipRole: WeddingRole | string | null | undefined): boolean {
  return isPlatformSuperAdmin(actor) || parseWeddingRole(membershipRole) !== null;
}

export function canManageWeddingMembers(
  actor: AccessActor,
  membershipRole: WeddingRole | string | null | undefined,
): boolean {
  return isPlatformSuperAdmin(actor) || parseWeddingRole(membershipRole) === "owner";
}

/** Prisma filter selecting every event (active or deleted) the actor may access. */
export function accessibleEventsWhere(actor: AccessActor): Prisma.EventWhereInput {
  if (isPlatformSuperAdmin(actor)) return {};
  return {
    OR: [
      { weddingId: { not: null }, wedding: { memberships: { some: { userId: actor.id } } } },
      { weddingId: null, ownerUserId: actor.id },
    ],
  };
}

export type ActiveWorkspaceScope =
  | { kind: "all" }
  | { kind: "unassigned" }
  | { kind: "wedding"; weddingId: string }
  | { kind: "none" };

/** Narrows the accessible events to the currently selected workspace. Always combined with `accessibleEventsWhere`. */
export function eventsInScopeWhere(actor: AccessActor, scope: ActiveWorkspaceScope): Prisma.EventWhereInput {
  const accessible = accessibleEventsWhere(actor);
  switch (scope.kind) {
    case "all":
      return isPlatformSuperAdmin(actor) ? accessible : { id: "__no_access__" };
    case "unassigned":
      return { AND: [accessible, { weddingId: null }] };
    case "wedding":
      return { AND: [accessible, { weddingId: scope.weddingId }] };
    case "none":
    default:
      return { id: "__no_access__" };
  }
}

export type MembershipRow = { id: string; userId: string; role: string };

/** True when applying the change would leave the wedding with no owner. */
export function wouldLeaveWeddingWithoutOwner(
  memberships: MembershipRow[],
  change: { membershipId: string; nextRole: WeddingRole | null },
): boolean {
  const owners = memberships.filter((m) => {
    if (m.id === change.membershipId) return change.nextRole === "owner";
    return m.role === "owner";
  });
  return owners.length === 0;
}

export const ACTIVE_WEDDING_COOKIE = "active_wedding";
export const ACTIVE_WEDDING_ALL = "all";
export const ACTIVE_WEDDING_UNASSIGNED = "unassigned";

export type WorkspaceOption = { id: string; name: string; role: WeddingRole | null };

/**
 * Resolves which workspace the dashboard should show from the (untrusted) cookie value.
 * The cookie is a preference only; every value is checked against the actor's real access.
 */
export function resolveActiveWorkspaceScope(input: {
  actor: AccessActor;
  cookieValue: string | null | undefined;
  weddings: WorkspaceOption[];
  hasUnassignedEvents: boolean;
}): ActiveWorkspaceScope {
  const { actor, cookieValue, weddings, hasUnassignedEvents } = input;
  const value = cookieValue?.trim() || "";
  const isSuper = isPlatformSuperAdmin(actor);

  if (value && value !== ACTIVE_WEDDING_ALL && value !== ACTIVE_WEDDING_UNASSIGNED) {
    const match = weddings.find((w) => w.id === value);
    if (match && (isSuper || match.role !== null)) {
      return { kind: "wedding", weddingId: match.id };
    }
  }
  if (value === ACTIVE_WEDDING_UNASSIGNED && (isSuper || hasUnassignedEvents)) {
    return { kind: "unassigned" };
  }
  if (isSuper) {
    return { kind: "all" };
  }
  const firstMembership = weddings.find((w) => w.role !== null);
  if (firstMembership) {
    return { kind: "wedding", weddingId: firstMembership.id };
  }
  if (hasUnassignedEvents) {
    return { kind: "unassigned" };
  }
  return { kind: "none" };
}

export function workspaceScopeValue(scope: ActiveWorkspaceScope): string {
  switch (scope.kind) {
    case "wedding":
      return scope.weddingId;
    case "unassigned":
      return ACTIVE_WEDDING_UNASSIGNED;
    case "all":
      return ACTIVE_WEDDING_ALL;
    default:
      return "";
  }
}

export function buildWorkspaceSwitcherOptions(input: {
  actor: AccessActor;
  weddings: WorkspaceOption[];
  hasUnassignedEvents: boolean;
}): { value: string; label: string }[] {
  const isSuper = isPlatformSuperAdmin(input.actor);
  const options: { value: string; label: string }[] = [];
  if (isSuper) options.push({ value: ACTIVE_WEDDING_ALL, label: "All weddings (platform)" });
  for (const w of input.weddings) {
    options.push({ value: w.id, label: w.name });
  }
  if (isSuper || input.hasUnassignedEvents) {
    options.push({ value: ACTIVE_WEDDING_UNASSIGNED, label: "Unassigned legacy events" });
  }
  return options;
}

/** Only internal admin paths are allowed as post-action redirect targets. */
export function sanitizeAdminReturnPath(value: unknown, fallback = "/admin/events"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/") || trimmed.startsWith("//") || trimmed.includes("\\")) return fallback;
  return trimmed;
}
