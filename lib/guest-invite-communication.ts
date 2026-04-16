import { buildGuestWhatsAppInviteMessage } from "@/lib/whatsapp";

export function buildGuestInviteEmailSubject(eventTitle: string, guestName: string) {
  return `${eventTitle} · Invitation for ${guestName}`;
}

/** Plain-text body as sent by email (matches `sendGuestInviteEmailAction`). */
export function buildGuestInviteEmailBody(inviteText: string) {
  return [inviteText, "", "If you have questions, please reply to this message."].join("\n");
}

export function buildGuestInviteEmailLines(inviteText: string): string[] {
  return [inviteText, "", "If you have questions, please reply to this message."];
}

export type GuestInviteMessageParts = {
  inviteText: string;
  emailSubject: string;
  emailBody: string;
};

/** Invite email + shared WhatsApp text from the same RSVP link (single source of truth). */
export function buildGuestInviteCommunicationParts(input: {
  guestId?: string;
  greeting: string | null;
  guestName: string;
  eventTitle: string;
  coupleNames?: string | null;
  rsvpLink: string;
  customIntroLine?: string | null;
  customLineOverride?: string | null;
}): GuestInviteMessageParts {
  const inviteText = buildGuestWhatsAppInviteMessage({
    guestId: input.guestId,
    greeting: input.greeting,
    guestName: input.guestName,
    eventTitle: input.eventTitle,
    coupleNames: input.coupleNames,
    rsvpLink: input.rsvpLink,
    customIntroLine: input.customIntroLine,
    customLineOverride: input.customLineOverride,
  });
  const emailSubject = buildGuestInviteEmailSubject(input.eventTitle, input.guestName);
  const emailBody = buildGuestInviteEmailBody(inviteText);
  return { inviteText, emailSubject, emailBody };
}
