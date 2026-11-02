import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listAccessibleEventIds } from "@/lib/wedding-access";
import type { AccessActor } from "@/lib/wedding-policy";

/**
 * Notifications a user may list: their own, minus event notifications for events they can no
 * longer access (e.g. after being removed from a wedding). Super admins keep the global view.
 */
export async function notificationVisibilityWhere(actor: AccessActor): Promise<Prisma.NotificationWhereInput | undefined> {
  const accessibleEventIds = await listAccessibleEventIds(actor);
  if (accessibleEventIds === null) return undefined;
  return {
    userId: actor.id,
    OR: [{ eventId: null }, { eventId: { in: accessibleEventIds } }],
  };
}

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

/** Wedding events notify every wedding member; legacy unassigned events notify their owner as before. */
export async function getEventNotificationRecipientIds(eventId: string): Promise<string[]> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      ownerUserId: true,
      weddingId: true,
      wedding: {
        select: {
          memberships: {
            where: { user: { active: true, deletedAt: null } },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!event) return [];
  if (event.weddingId) {
    return Array.from(new Set(event.wedding?.memberships.map((m) => m.userId) ?? []));
  }
  return event.ownerUserId ? [event.ownerUserId] : [];
}

export async function notifyEventOwner(input: EventOwnerNotificationInput) {
  try {
    const userIds = await getEventNotificationRecipientIds(input.eventId);
    if (userIds.length === 0) return;
    await notifyUsers({
      userIds,
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
