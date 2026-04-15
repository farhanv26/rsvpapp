import "server-only";

import { prisma } from "@/lib/prisma";

export type GuestCommunicationChannel = "whatsapp" | "email" | "manual";

export async function logGuestCommunication(input: {
  eventId: string;
  guestId: string;
  userId: string | null;
  actorName: string | null;
  channel: GuestCommunicationChannel;
  actionKey: string;
  label: string;
  detail?: string | null;
  success?: boolean;
}) {
  try {
    await prisma.guestCommunicationLog.create({
      data: {
        eventId: input.eventId,
        guestId: input.guestId,
        userId: input.userId,
        actorName: input.actorName,
        channel: input.channel,
        actionKey: input.actionKey,
        label: input.label,
        detail: input.detail ? input.detail.slice(0, 500) : null,
        success: input.success ?? true,
      },
    });
  } catch (error) {
    console.error("[guest-communication-log] failed to write", {
      eventId: input.eventId,
      guestId: input.guestId,
      actionKey: input.actionKey,
      error,
    });
  }
}

export function channelLabel(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "Email";
  if (channel === "manual") return "Manual";
  return channel;
}
