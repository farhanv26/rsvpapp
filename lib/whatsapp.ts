type GuestWhatsAppMessageInput = {
  guestId?: string;
  greeting?: string | null;
  guestName: string;
  eventTitle: string;
  coupleNames?: string | null;
  rsvpLink: string;
  customLineOverride?: string | null;
  customIntroLine?: string | null;
};

const INVITE_MESSAGE_VARIANTS = [
  "Your presence would truly make this event special.",
  "We would be delighted to celebrate this occasion with you.",
  "It would mean a great deal to have you join us.",
  "We sincerely hope you can celebrate with us.",
  "Your presence would make this occasion even more meaningful.",
  "We would be honoured to share this special day with you.",
  "We warmly hope you can join us for this celebration.",
  "Your company would make this celebration all the more memorable.",
  "We would be grateful to celebrate this moment with you.",
  "Your presence would add joy to this special occasion.",
  "We would be pleased to have you with us on this meaningful day.",
  "It would be a pleasure to celebrate together with you.",
  "We genuinely hope you can join us for this special celebration.",
  "Your presence would make this day even more memorable for us.",
  "We would be honoured by your company on this occasion.",
  "We look forward to celebrating this special day with you.",
  "It would be wonderful to share this celebration with you.",
  "We hope to celebrate this joyful occasion together with you.",
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
  customLineOverride?: string | null;
}) {
  const custom = input.customLineOverride?.trim();
  if (custom) return custom;
  const seed = input.guestId?.trim() || input.eventTitle;
  const index = hashString(seed) % INVITE_MESSAGE_VARIANTS.length;
  return INVITE_MESSAGE_VARIANTS[index].replace("{eventName}", input.eventTitle);
}

export function getInviteIntroLine(input: {
  eventTitle: string;
  coupleNames?: string | null;
  customIntroLine?: string | null;
}) {
  const custom = input.customIntroLine?.trim();
  if (custom) return custom;
  const coupleNames = input.coupleNames?.trim();
  if (coupleNames) {
    return `You are cordially invited to ${coupleNames}’s ${input.eventTitle}`;
  }
  return `You are cordially invited to our ${input.eventTitle}`;
}

export function buildGuestInviteMessageParts(input: GuestWhatsAppMessageInput) {
  const greeting = input.greeting?.trim() || "Assalamu Alaikum";
  const introLine = getInviteIntroLine({
    eventTitle: input.eventTitle,
    coupleNames: input.coupleNames,
    customIntroLine: input.customIntroLine,
  });
  const randomizedLine = getInviteMessage({
    guestId: input.guestId,
    eventTitle: input.eventTitle,
    customLineOverride: input.customLineOverride,
  });
  const greetingLine = `${greeting} ${input.guestName},`;
  return {
    greetingLine,
    introLine,
    randomizedLine,
    finalMessage: `${greetingLine}

${introLine}

${randomizedLine}

Please RSVP here:
${input.rsvpLink}`,
  };
}

export function buildGuestWhatsAppInviteMessage(input: GuestWhatsAppMessageInput) {
  return buildGuestInviteMessageParts(input).finalMessage;
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
