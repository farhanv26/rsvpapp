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

type Params = { params: Promise<{ eventId: string; guestId: string }> };

/**
 * POST /admin/api/mobile/events/[eventId]/guests/[guestId]/mark-invited
 * Body: { channel: "whatsapp" | "email" | "manual" | "imessage" }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId, guestId } = await params;

  try {
    const event = await withReconnect(() =>
      prisma.event.findFirst({
        where: { id: eventId, deletedAt: null },
        select: { id: true, ownerUserId: true },
      })
    );
    if (!event) return notFoundResponse("Event not found");
    if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

    const guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId, deletedAt: null },
      select: { id: true, guestName: true, invitedAt: true, inviteCount: true },
    });
    if (!guest) return notFoundResponse("Guest not found");

    let body: { channel?: string } = {};
    try { body = await req.json(); } catch { /* ignore, default below */ }
    const channel = (body.channel ?? "manual") as string;
    const validChannels = ["whatsapp", "email", "manual", "imessage"];
    if (!validChannels.includes(channel)) {
      return Response.json({ error: "Invalid channel" }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.guest.update({
      where: { id: guestId },
      data: {
        invitedAt: guest.invitedAt ?? now,
        inviteChannelLastUsed: channel,
        inviteCount: { increment: 1 },
      },
      select: { id: true, guestName: true, invitedAt: true, inviteCount: true, inviteChannelLastUsed: true },
    });

    await logAuditActivity({
      eventId,
      userId: user.id,
      userName: user.name,
      actionType: "guest_invite_sent",
      entityType: "Guest",
      entityId: guestId,
      entityName: guest.guestName,
      message: `${user.name} marked "${guest.guestName}" as invited via ${channel} (mobile).`,
      metadata: { channel },
    });

    return Response.json({ guest: updated });
  } catch (err) {
    console.error("[mobile/mark-invited POST]", err);
    return Response.json({ error: "Failed to mark as invited" }, { status: 500 });
  }
}
