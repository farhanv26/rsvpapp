type GuestWhatsAppMessageInput = {
  greeting?: string | null;
  guestName: string;
  eventTitle: string;
  rsvpLink: string;
};

export function buildGuestWhatsAppInviteMessage(input: GuestWhatsAppMessageInput) {
  const greeting = input.greeting?.trim() || "Assalamu Alaikum";
  return `${greeting} ${input.guestName},

You’re invited to our ${input.eventTitle}.

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
