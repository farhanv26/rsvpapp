/**
 * Centralized logic for which invite card image a guest sees on the RSVP page.
 * Priority: exact maxGuests slot (1–4) → family card (if flagged) → generic → default event image.
 */

export type InviteCardEventInput = {
  imagePath: string | null;
  genericCardImage: string | null;
  cardImage1: string | null;
  cardImage2: string | null;
  cardImage3: string | null;
  cardImage4: string | null;
  familyCardImage: string | null;
};

export type InviteCardGuestInput = {
  maxGuests: number;
  isFamilyInvite: boolean;
};

export type InviteCardResolution = {
  /** Stored path (unsafe until passed through getSafeImageSrc). */
  rawPath: string | null;
  /** Short label for UI, e.g. "2 Guest Card". */
  variantLabel: string;
  /** Which rule matched (for debugging). */
  source: "maxGuests" | "family" | "generic" | "default";
};

function trimmed(path: string | null | undefined): string | null {
  const t = path?.trim();
  return t ? t : null;
}

export function resolveInviteCardImage(
  event: InviteCardEventInput,
  guest: InviteCardGuestInput,
): InviteCardResolution {
  const mg = guest.maxGuests;
  const bySlot: Record<1 | 2 | 3 | 4, { path: string | null; label: string }> = {
    1: { path: trimmed(event.cardImage1), label: "1 Guest Card" },
    2: { path: trimmed(event.cardImage2), label: "2 Guest Card" },
    3: { path: trimmed(event.cardImage3), label: "3 Guest Card" },
    4: { path: trimmed(event.cardImage4), label: "4 Guest Card" },
  };

  if (mg === 1 || mg === 2 || mg === 3 || mg === 4) {
    const slot = bySlot[mg];
    if (slot.path) {
      return { rawPath: slot.path, variantLabel: slot.label, source: "maxGuests" };
    }
  }

  if (guest.isFamilyInvite) {
    const fam = trimmed(event.familyCardImage);
    if (fam) {
      return { rawPath: fam, variantLabel: "Family Card", source: "family" };
    }
  }

  const gen = trimmed(event.genericCardImage);
  if (gen) {
    return { rawPath: gen, variantLabel: "Generic Card", source: "generic" };
  }

  const def = trimmed(event.imagePath);
  return { rawPath: def, variantLabel: "Default Card", source: "default" };
}

export function inviteCardUsingLabel(resolution: InviteCardResolution): string {
  return `Using: ${resolution.variantLabel}`;
}
