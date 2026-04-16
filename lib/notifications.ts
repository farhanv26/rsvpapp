import "server-only";

import { prisma } from "@/lib/prisma";

type NotificationEntityType = "Event" | "Guest" | "RSVP" | "User" | "System";

type NotificationWriteInput = {
  userId: string;
  type: string;
  title: string;
  description?: string;
  entityType: NotificationEntityType;
  entityId: string;
  eventId?: string | null;
};

type EventOwnerNotificationInput = {
  eventId: string;
  type: string;
  title: string;
  description?: string;
  entityType: NotificationEntityType;
  entityId: string;
};

async function createNotification(input: NotificationWriteInput) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      eventId: input.eventId ?? null,
    },
  });
}

export async function notifyUser(input: NotificationWriteInput) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("[notification] failed to create user notification", {
      userId: input.userId,
      type: input.type,
      error,
    });
  }
}

export async function notifyUsers(input: Omit<NotificationWriteInput, "userId"> & { userIds: string[] }) {
  const uniqueUserIds = Array.from(new Set(input.userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        eventId: input.eventId ?? null,
      })),
    });
  } catch (error) {
    console.error("[notification] failed to create notifications for users", {
      userIds: uniqueUserIds,
      type: input.type,
      error,
    });
  }
}

export async function notifyEventOwner(input: EventOwnerNotificationInput) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { ownerUserId: true },
    });
    if (!event?.ownerUserId) return;
    await createNotification({
      userId: event.ownerUserId,
      type: input.type,
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
      eventId: input.eventId,
    });
  } catch (error) {
    console.error("[notification] failed to create event-owner notification", {
      eventId: input.eventId,
      type: input.type,
      error,
    });
  }
}
