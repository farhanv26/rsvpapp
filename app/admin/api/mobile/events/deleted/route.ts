import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";

/** GET /admin/api/mobile/events/deleted — list soft-deleted events. */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const where = {
    deletedAt: { not: null },
    ...(isMobileSuperAdmin(user) ? {} : { ownerUserId: user.id }),
  };

  try {
    const events = await withReconnect(() =>
      prisma.event.findMany({
        where,
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          title: true,
          coupleNames: true,
          eventDate: true,
          venue: true,
          imagePath: true,
          deletedAt: true,
          createdAt: true,
          _count: { select: { guests: { where: { deletedAt: null } } } },
        },
      })
    );

    return Response.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        coupleNames: e.coupleNames,
        eventDate: e.eventDate?.toISOString() ?? null,
        venue: e.venue,
        imagePath: e.imagePath ?? null,
        deletedAt: e.deletedAt!.toISOString(),
        createdAt: e.createdAt.toISOString(),
        guestCount: e._count.guests,
      })),
    });
  } catch (err) {
    console.error("[mobile/events/deleted GET]", err);
    return Response.json({ error: "Failed to load deleted events" }, { status: 500 });
  }
}
