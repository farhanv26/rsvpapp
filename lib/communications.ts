import "server-only";

import type { Prisma } from "@prisma/client";
import { logAuditActivity } from "@/lib/audit-log";
import { notifyEventOwner } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendEventOwnerNotificationEmail } from "@/lib/rsvp-email";
import { buildGuestWhatsAppInviteMessage } from "@/lib/whatsapp";

type CommunicationChannels = {
  inApp?: boolean;
  email?: boolean;
  whatsapp?: boolean;
};

type TriggerType =
  | "rsvp_submitted"
  | "rsvp_updated"
  | "guest_added"
  | "guest_deleted"
  | "event_updated";

type DispatchEventCommunicationInput = {
  trigger: TriggerType;
  eventId: string;
  entityType: "Event" | "Guest" | "RSVP";
  entityId: string;
  title: string;
  description?: string;
  guestName?: string;
  attendingLabel?: string;
  attendingCount?: number | null;
  hostMessage?: string | null;
  metadata?: Prisma.InputJsonValue;
  actorName?: string;
  channels?: CommunicationChannels;
};

function withDefaultChannels(channels?: CommunicationChannels) {
  return {
    inApp: channels?.inApp ?? true,
    email: channels?.email ?? true,
    whatsapp: channels?.whatsapp ?? false,
  };
}

function formatTriggerLabel(trigger: TriggerType) {
  return trigger
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function scheduleBackgroundTask(task: () => Promise<void>, label: string) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(`[communication] ${label} failed`, { error });
    });
}

async function queueEventOwnerEmail(input: DispatchEventCommunicationInput) {
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, deletedAt: null },
    select: { id: true, title: true, ownerUserId: true },
  });

  if (!event?.ownerUserId) {
    return;
  }

  await logAuditActivity({
    eventId: input.eventId,
    userId: null,
    userName: input.actorName ?? "System",
    actionType: "communication_email_queued",
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.guestName ?? event.title,
    message: `Email notification queued for ${formatTriggerLabel(input.trigger)}.`,
    metadata: input.metadata ?? undefined,
  });

  scheduleBackgroundTask(async () => {
    const lines: string[] = [
      `Event: ${event.title}`,
      `Trigger: ${formatTriggerLabel(input.trigger)}`,
      input.guestName ? `Guest: ${input.guestName}` : "",
      input.attendingLabel ? `Attendance: ${input.attendingLabel}` : "",
      typeof input.attendingCount === "number" ? `Guest count: ${input.attendingCount}` : "",
      input.hostMessage ? `Message to host: ${input.hostMessage}` : "",
      `When: ${new Date().toISOString()}`,
    ].filter(Boolean);

    try {
      await sendEventOwnerNotificationEmail({
        eventTitle: event.title,
        subject: `${event.title} · ${formatTriggerLabel(input.trigger)}`,
        lines,
      });
      await logAuditActivity({
        eventId: input.eventId,
        userId: null,
        userName: "System",
        actionType: "communication_email_sent",
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.guestName ?? event.title,
        message: `Email notification sent for ${formatTriggerLabel(input.trigger)}.`,
        metadata: input.metadata ?? undefined,
      });
    } catch (error) {
      console.error("[communication] failed to send email notification", {
        eventId: input.eventId,
        trigger: input.trigger,
        entityId: input.entityId,
        error,
      });
      await logAuditActivity({
        eventId: input.eventId,
        userId: null,
        userName: "System",
        actionType: "communication_email_failed",
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.guestName ?? event.title,
        message: `Email notification failed for ${formatTriggerLabel(input.trigger)}.`,
        metadata: input.metadata ?? undefined,
      });
    }
  }, `email ${input.trigger}`);
}

export async function dispatchEventCommunication(input: DispatchEventCommunicationInput) {
  const channels = withDefaultChannels(input.channels);

  if (channels.inApp) {
    await notifyEventOwner({
      eventId: input.eventId,
      type: input.trigger.toUpperCase(),
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }

  if (channels.email) {
    await queueEventOwnerEmail(input);
  }
}

export { buildGuestWhatsAppInviteMessage };
