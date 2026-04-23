import type { PrismaClient } from "@prisma/client";
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

export async function resolveSharedGuestState(
  prisma: PrismaClient,
  options: ResolveSharedGuestOptions,
): Promise<SharedGuestResolution> {
  const sharedGuestKey = buildSharedGuestKey(options);
  if (!sharedGuestKey) {
    return {
      sharedGuestKey: null,
      isSharedAcrossEvents: false,
      countOwnerEventId: null,
      shouldExcludeFromTotals: false,
      defaultExcludeReason: null,
    };
  }

  const match = await prisma.guest.findFirst({
    where: {
      sharedGuestKey,
      deletedAt: null,
      eventId: { not: options.eventId },
      ...(options.guestId ? { id: { not: options.guestId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      eventId: true,
      countOwnerEventId: true,
    },
  });

  const isSharedAcrossEvents = Boolean(match);
  const countOwnerEventId = match ? match.countOwnerEventId ?? match.eventId : null;
  const shouldExcludeFromTotals = Boolean(countOwnerEventId && countOwnerEventId !== options.eventId);

  return {
    sharedGuestKey,
    isSharedAcrossEvents,
    countOwnerEventId,
    shouldExcludeFromTotals,
    defaultExcludeReason: shouldExcludeFromTotals ? "Duplicate guest in another event" : null,
  };
}
