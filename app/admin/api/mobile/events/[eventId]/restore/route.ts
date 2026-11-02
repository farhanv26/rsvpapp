import type { NextRequest } from "next/server";
import { authorizeMobileEvent, getMobileAdminUser, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";

/** POST /admin/api/mobile/events/[eventId]/restore — restore a soft-deleted event. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const authz = await authorizeMobileEvent(user, eventId, {
    state: "deleted",
    organizerOnly: true,
    notFoundMessage: "Deleted event not found",
  });
  if (authz.error) return authz.error;
  const event = authz.event;

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
