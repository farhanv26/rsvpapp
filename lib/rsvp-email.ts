import "server-only";

import { Resend } from "resend";

export type EventOwnerEmailPayload = {
  eventTitle: string;
  subject: string;
  lines: string[];
  to?: string | null;
};

export type RsvpEmailPayload = {
  eventTitle: string;
  guestName: string;
  attending: boolean;
  attendingCount: number | null;
  respondedAtIso: string;
  hostMessage: string | null;
  changeType: string;
};

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export async function sendEventOwnerNotificationEmail(payload: EventOwnerEmailPayload) {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("RESEND_FROM");
  const to = payload.to?.trim() || getEnv("RSVP_NOTIFY_EMAIL");

  if (!apiKey || !from || !to) {
    // Not configured; silently skip.
    return;
  }

  const resend = new Resend(apiKey);
  const text = payload.lines.join("\n");

  await resend.emails.send({
    from,
    to,
    subject: payload.subject,
    text,
  });
}

export async function sendRsvpNotificationEmail(payload: RsvpEmailPayload) {
  const subject = `${payload.eventTitle} · RSVP ${payload.attending ? "Accepted" : "Declined"} (${payload.guestName})`;
  const lines: string[] = [];
  lines.push(`Event: ${payload.eventTitle}`);
  lines.push(`Guest: ${payload.guestName}`);
  lines.push(`Status: ${payload.attending ? "Attending" : "Declined"}`);
  if (payload.attending) {
    lines.push(`Count: ${payload.attendingCount ?? 0}`);
  }
  lines.push(`When: ${payload.respondedAtIso}`);
  lines.push(`Type: ${payload.changeType}`);
  if (payload.hostMessage) {
    lines.push("");
    lines.push("Message to host:");
    lines.push(payload.hostMessage);
  }
  await sendEventOwnerNotificationEmail({
    eventTitle: payload.eventTitle,
    subject,
    lines,
  });
}
