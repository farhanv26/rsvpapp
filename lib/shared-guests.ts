import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizePhoneForWhatsAppGuestRecord } from "@/lib/whatsapp";

type SharedGuestIdentity = {
  guestName: string;
  phone?: string | null;
  phoneCountryCode?: string | null;
  email?: string | null;
};

type ResolveSharedGuestOptions = SharedGuestIdentity & {
  eventId: string;
  guestId?: string;
};

export type SharedGuestResolution = {
  sharedGuestKey: string | null;
  isSharedAcrossEvents: boolean;
  countOwnerEventId: string | null;
  shouldExcludeFromTotals: boolean;
  defaultExcludeReason: string | null;
};

function normalizeTextToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeGuestNameForSharedKey(value: string): string {
  return normalizeTextToken(value);
}

export function normalizeEmailForSharedKey(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return normalizeTextToken(value);
}

export function normalizePhoneForSharedKey(input: {
  phone: string | null | undefined;
  phoneCountryCode: string | null | undefined;
}): string | null {
  const normalized = normalizePhoneForWhatsAppGuestRecord({
    phone: input.phone ?? null,
    phoneCountryCode: input.phoneCountryCode ?? null,
  });
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function buildSharedGuestKey(input: SharedGuestIdentity): string | null {
  const name = normalizeGuestNameForSharedKey(input.guestName);
  if (!name) return null;
  const phone = normalizePhoneForSharedKey({
    phone: input.phone ?? null,
    phoneCountryCode: input.phoneCountryCode ?? null,
  });
  const email = normalizeEmailForSharedKey(input.email ?? null);

  if (phone) return `n:${name}|p:${phone}`;
  if (email) return `n:${name}|e:${email}`;
  return `n:${name}`;
}

export { LEGACY_AUTOMATIC_EXCLUDE_REASONS as AUTO_SHARED_EXCLUDE_REASONS } from "./attendance";

/**
 * Matching boundary for shared guests. Matches never cross weddings; events that have not
 * been assigned to a wedding yet (weddingId = null) never match any other event.
 */
export type SharedGuestScope = { eventId: string; weddingId: string | null };

export async function getSharedGuestScope(prisma: PrismaClient, eventId: string): Promise<SharedGuestScope> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { weddingId: true } });
  return { eventId, weddingId: event?.weddingId ?? null };
}

/** Prisma filter for candidate matches, or null when the scope allows no cross-event matching. */
export function buildSharedGuestMatchWhere(
  scope: SharedGuestScope,
  sharedGuestKey: string,
  excludeGuestId?: string,
): Prisma.GuestWhereInput | null {
  if (!scope.weddingId) return null;
  return {
    sharedGuestKey,
    deletedAt: null,
    eventId: { not: scope.eventId },
    event: { weddingId: scope.weddingId },
    ...(excludeGuestId ? { id: { not: excludeGuestId } } : {}),
  };
}

/** Filter for other guests in the same wedding sharing a key (used when re-assigning count ownership). */
export function buildSharedGuestSiblingsWhere(
  scope: SharedGuestScope,
  sharedGuestKey: string,
  guestId: string,
): Prisma.GuestWhereInput | null {
  if (!scope.weddingId) return null;
  return {
    sharedGuestKey,
    deletedAt: null,
    id: { not: guestId },
    event: { weddingId: scope.weddingId },
  };
}

/**
 * Returns `candidate` only when it names an event in the same wedding as the scope
 * (or the scope's own event); otherwise null. Prevents a client-supplied
 * countOwnerEventId from pointing a guest's totals at another wedding.
 */
export async function sanitizeCountOwnerEventId(
  prisma: PrismaClient,
  scope: SharedGuestScope,
  candidate: string | null | undefined,
): Promise<string | null> {
  const value = candidate?.trim();
  if (!value) return null;
  if (value === scope.eventId) return value;
  if (!scope.weddingId) return null;
  const owner = await prisma.event.findFirst({
    where: { id: value, weddingId: scope.weddingId },
    select: { id: true },
  });
  return owner ? owner.id : null;
}

export async function resolveSharedGuestState(
  prisma: PrismaClient,
  options: ResolveSharedGuestOptions,
  scopeInput?: SharedGuestScope,
): Promise<SharedGuestResolution> {
  const sharedGuestKey = buildSharedGuestKey(options);
  const noMatch: SharedGuestResolution = {
    sharedGuestKey,
    isSharedAcrossEvents: false,
    countOwnerEventId: null,
    shouldExcludeFromTotals: false,
    defaultExcludeReason: null,
  };
  if (!sharedGuestKey) {
    return noMatch;
  }
  if (scopeInput && scopeInput.eventId !== options.eventId) {
    throw new Error("Shared guest scope does not match the target event.");
  }

  const scope = scopeInput ?? (await getSharedGuestScope(prisma, options.eventId));
  const where = buildSharedGuestMatchWhere(scope, sharedGuestKey, options.guestId);
  if (!where) {
    return noMatch;
  }

  const match = await prisma.guest.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      eventId: true,
      countOwnerEventId: true,
    },
  });
  if (!match) {
    return noMatch;
  }

  // A household invited to several events counts toward each of them; matching is informational only.
  return { ...noMatch, isSharedAcrossEvents: true };
}
