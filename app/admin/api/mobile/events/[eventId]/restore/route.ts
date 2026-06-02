import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";

/** POST /admin/api/mobile/events/[eventId]/restore — restore a soft-deleted event. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await withReconnect(() =>
    prisma.event.findFirst({
      where: { id: eventId, deletedAt: { not: null } },
      select: { id: true, title: true, ownerUserId: true },
    })
  );
  if (!event) return notFoundResponse("Deleted event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  try {
    await prisma.event.update({ where: { id: eventId }, data: { deletedAt: null } });

    await logAuditActivity({
      eventId,
      userId: user.id,
      userName: user.name,
      actionType: "event_restored",
      entityType: "Event",
      entityId: eventId,
      entityName: event.title,
      message: `${user.name} restored event "${event.title}" via mobile.`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[mobile/event/restore POST]", err);
    return Response.json({ error: "Failed to restore event" }, { status: 500 });
  }
}
