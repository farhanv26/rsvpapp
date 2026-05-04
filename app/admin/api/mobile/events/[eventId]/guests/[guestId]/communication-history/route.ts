import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";

type Params = { params: Promise<{ eventId: string; guestId: string }> };

/**
 * GET /admin/api/mobile/events/[eventId]/guests/[guestId]/communication-history
 * Returns the communication log for a specific guest.
 */
export async function GET(req: NextRequest, { params }: Params) {
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
      select: { id: true, guestName: true },
    });
    if (!guest) return notFoundResponse("Guest not found");

    const logs = await prisma.guestCommunicationLog.findMany({
      where: { guestId, eventId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        channel: true,
        actionKey: true,
        label: true,
        detail: true,
        success: true,
        actorName: true,
        createdAt: true,
      },
    });

    return Response.json({
      guestName: guest.guestName,
      logs: logs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[mobile/communication-history GET]", err);
    return Response.json({ error: "Failed to load communication history" }, { status: 500 });
  }
}
