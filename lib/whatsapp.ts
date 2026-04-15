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

export function getWhatsAppShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
