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

type Params = { params: Promise<{ eventId: string }> };

/**
 * POST /admin/api/mobile/events/[eventId]/guests/bulk
 * Body: { action: "mark_invited" | "delete", guestIds: string[], channel?: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await withReconnect(() =>
    prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    })
  );
  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  let body: { action?: string; guestIds?: unknown; channel?: string } = {};
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, channel = "manual" } = body;
  const guestIds = Array.isArray(body.guestIds) ? (body.guestIds as string[]) : [];

  if (!action || !["mark_invited", "delete"].includes(action)) {
    return Response.json({ error: "action must be 'mark_invited' or 'delete'" }, { status: 400 });
  }
  if (guestIds.length === 0) {
    return Response.json({ error: "guestIds must be a non-empty array" }, { status: 400 });
  }
  if (guestIds.length > 200) {
    return Response.json({ error: "Maximum 200 guests per bulk operation" }, { status: 400 });
  }

  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds }, eventId, deletedAt: null },
    select: { id: true, guestName: true },
  });

  if (guests.length === 0) return Response.json({ error: "No matching guests found" }, { status: 404 });

  try {
    if (action === "mark_invited") {
      await prisma.guest.updateMany({
        where: { id: { in: guests.map((g) => g.id) } },
        data: {
          invitedAt: new Date(),
          inviteChannelLastUsed: channel,
          inviteCount: { increment: 1 },
        },
      });
      await logAuditActivity({
        eventId,
        userId: user.id,
        userName: user.name,
        actionType: "guest_invite_marked",
        entityType: "Event",
        entityId: eventId,
        entityName: `${guests.length} guests`,
        message: `${user.name} bulk marked ${guests.length} guests as invited via ${channel} (mobile).`,
        metadata: { guestIds: guests.map((g) => g.id), channel },
      });
    } else if (action === "delete") {
      await prisma.guest.updateMany({
        where: { id: { in: guests.map((g) => g.id) } },
        data: { deletedAt: new Date() },
      });
      await logAuditActivity({
        eventId,
        userId: user.id,
        userName: user.name,
        actionType: "guest_bulk_deleted",
        entityType: "Event",
        entityId: eventId,
        entityName: `${guests.length} guests`,
        message: `${user.name} bulk deleted ${guests.length} guests (mobile).`,
        metadata: { guestIds: guests.map((g) => g.id) },
      });
    }

    return Response.json({ ok: true, affected: guests.length });
  } catch (err) {
    console.error("[mobile/guests/bulk POST]", err);
    return Response.json({ error: "Bulk operation failed" }, { status: 500 });
  }
}
