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
 * POST /admin/api/mobile/events/[eventId]/guests/[guestId]/record-rsvp
 * Body: { attending: boolean; attendingCount?: number; notes?: string }
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
      select: { id: true, guestName: true, maxGuests: true, attending: true },
    });
    if (!guest) return notFoundResponse("Guest not found");

    let body: { attending?: boolean; attendingCount?: number; notes?: string } = {};
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.attending !== "boolean") {
      return Response.json({ error: "attending (boolean) is required" }, { status: 400 });
    }

    const attending = body.attending;
    const attendingCount = attending
      ? Math.min(Math.max(1, body.attendingCount ?? 1), guest.maxGuests)
      : null;

    const updated = await prisma.guest.update({
      where: { id: guestId },
      data: {
        attending,
        attendingCount,
        respondedAt: new Date(),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      select: {
        id: true,
        guestName: true,
        attending: true,
        attendingCount: true,
        respondedAt: true,
      },
    });

    const wasAttending = guest.attending;
    const actionType =
      wasAttending === null
        ? "admin_recorded_rsvp"
        : wasAttending !== attending
          ? attending ? "admin_recorded_rsvp" : "admin_recorded_rsvp"
          : "admin_updated_rsvp";

    await prisma.rsvpActivity.create({
      data: {
        eventId,
        guestId,
        type: actionType,
        description: `${user.name} manually recorded RSVP for "${guest.guestName}": ${attending ? `attending (${attendingCount})` : "declined"} via mobile.`,
      },
    });

    await logAuditActivity({
      eventId,
      userId: user.id,
      userName: user.name,
      actionType,
      entityType: "Guest",
      entityId: guestId,
      entityName: guest.guestName,
      message: `${user.name} recorded RSVP for "${guest.guestName}": ${attending ? "attending" : "declined"} (mobile).`,
      metadata: { attending, attendingCount },
    });

    return Response.json({ guest: updated });
  } catch (err) {
    console.error("[mobile/record-rsvp POST]", err);
    return Response.json({ error: "Failed to record RSVP" }, { status: 500 });
  }
}
