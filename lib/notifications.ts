import "server-only";

import { prisma } from "@/lib/prisma";

type NotificationEntityType = "Event" | "Guest" | "RSVP";

type EventOwnerNotificationInput = {
  eventId: string;
  type: string;
  title: string;
  description?: string;
  entityType: NotificationEntityType;
  entityId: string;
};

export async function notifyEventOwner(input: EventOwnerNotificationInput) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { ownerUserId: true },
    });
    if (!event?.ownerUserId) return;
    await prisma.notification.create({
      data: {
        userId: event.ownerUserId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        eventId: input.eventId,
      },
    });
  } catch (error) {
    console.error("[notification] failed to create event-owner notification", {
      eventId: input.eventId,
      type: input.type,
      error,
    });
  }
}
