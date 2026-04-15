import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditEntityType = "Event" | "Guest" | "RSVP" | "User";

type LogAuditInput = {
  eventId?: string | null;
  userId?: string | null;
  userName: string;
  actionType: string;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string | null;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logAuditActivity(input: LogAuditInput) {
  try {
    await prisma.auditActivity.create({
      data: {
        eventId: input.eventId ?? null,
        userId: input.userId ?? null,
        userName: input.userName,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.entityName ?? null,
        message: input.message,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit activity", {
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}
