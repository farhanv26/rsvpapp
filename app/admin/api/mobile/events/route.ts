import type { NextRequest } from "next/server";
import { getMobileAdminUser, isMobileSuperAdmin, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";

/** GET /admin/api/mobile/events — list events owned by the current admin (all for super_admin). */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const where = {
    deletedAt: null,
    ...(isMobileSuperAdmin(user) ? {} : { ownerUserId: user.id }),
  };

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      coupleNames: true,
      eventDate: true,
      venue: true,
      theme: true,
      createdAt: true,
      _count: { select: { guests: { where: { deletedAt: null } } } },
    },
  });

  return Response.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      coupleNames: e.coupleNames,
      eventDate: e.eventDate?.toISOString() ?? null,
      venue: e.venue,
      theme: e.theme,
      createdAt: e.createdAt.toISOString(),
      guestCount: e._count.guests,
    })),
  });
}
