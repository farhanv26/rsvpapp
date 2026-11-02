import type { NextRequest } from "next/server";
import {
  authorizeMobileEvent,
  getMobileAdminUser,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";

type Params = { params: Promise<{ eventId: string; guestId: string }> };

/**
 * POST /admin/api/mobile/events/[eventId]/guests/[guestId]/mark-uninvited
 * Clears invite tracking state for a guest (resets invitedAt, channel, count, lastReminderAt).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId, guestId } = await params;

  try {
    const authz = await authorizeMobileEvent(user, eventId);
    if (authz.error) return authz.error;

    const guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId, deletedAt: null, ...authz.guestScope },
      select: { id: true, guestName: true },
    });
    if (!guest) return notFoundResponse("Guest not found");

    await prisma.guest.update({
      where: { id: guestId },
      data: {
        invitedAt: null,
        inviteChannelLastUsed: null,
        inviteCount: 0,
        lastReminderAt: null,
      },
    });

    await logAuditActivity({
      eventId,
      userId: user.id,
      userName: user.name,
      actionType: "guest_uninvited",
      entityType: "Guest",
      entityId: guestId,
      entityName: guest.guestName,
      message: `${user.name} marked "${guest.guestName}" as uninvited (mobile).`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[mobile/mark-uninvited POST]", err);
    return Response.json({ error: "Failed to mark as uninvited" }, { status: 500 });
  }
}
