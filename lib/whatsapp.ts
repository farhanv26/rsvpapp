type GuestWhatsAppMessageInput = {
  guestId?: string;
  greeting?: string | null;
  guestName: string;
  eventTitle: string;
  rsvpLink: string;
  customMessage?: string | null;
};

const INVITE_MESSAGE_VARIANTS = [
  "We would be honoured to have your presence at our {eventName}.",
  "We warmly invite you to join us for our {eventName}.",
  "It would mean a lot to us to have you celebrate with us at our {eventName}.",
  "We sincerely hope you can join us for our {eventName}.",
  "Your presence would truly make our {eventName} special.",
] as const;

function hashString(input: string): number {
  // Deterministic 32-bit hash for stable message assignment.
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getInviteMessage(input: {
  guestId?: string;
  eventTitle: string;
  customMessage?: string | null;
}) {
  const custom = input.customMessage?.trim();
  if (custom) return custom;
  const seed = input.guestId?.trim() || input.eventTitle;
  const index = hashString(seed) % INVITE_MESSAGE_VARIANTS.length;
  return INVITE_MESSAGE_VARIANTS[index].replace("{eventName}", input.eventTitle);
}

export function buildGuestWhatsAppInviteMessage(input: GuestWhatsAppMessageInput) {
  const greeting = input.greeting?.trim() || "Assalamu Alaikum";
  const inviteLine = getInviteMessage({
    guestId: input.guestId,
    eventTitle: input.eventTitle,
    customMessage: input.customMessage,
  });
  return `${greeting} ${input.guestName},

${inviteLine}

Please RSVP here:
${input.rsvpLink}`;
}

export function buildGuestRsvpReminderMessage(input: GuestWhatsAppMessageInput) {
  const greeting = input.greeting?.trim() || "Assalamu Alaikum";
  return `${greeting} ${input.guestName},

Just a friendly reminder to please RSVP for our ${input.eventTitle}.

You can respond here:
${input.rsvpLink}`;
}

export function getWhatsAppShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Returns digits-only phone suitable for wa.me/{digits} when length is sufficient; otherwise null. */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

/** Prefer direct chat when phone is valid; otherwise generic share link. */
export function getWhatsAppInviteUrlForGuest(
  phone: string | null | undefined,
  message: string,
): string {
  const n = normalizePhoneForWhatsApp(phone);
  const q = encodeURIComponent(message);
  if (n) {
    return `https://wa.me/${n}?text=${q}`;
  }
  return `https://wa.me/?text=${q}`;
}
