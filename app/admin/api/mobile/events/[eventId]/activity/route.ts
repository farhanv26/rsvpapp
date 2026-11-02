import type { NextRequest } from "next/server";
import { authorizeMobileEvent, getMobileAdminUser, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";

/** GET /admin/api/mobile/events/[eventId]/activity — recent RSVP activity (last 30). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  try {
    const authz = await authorizeMobileEvent(user, eventId);
    if (authz.error) return authz.error;

    const activities = await prisma.rsvpActivity.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
        guest: { select: { id: true, guestName: true } },
      },
    });

    return Response.json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        createdAt: a.createdAt.toISOString(),
        guestId: a.guest.id,
        guestName: a.guest.guestName,
      })),
    });
  } catch (err) {
    console.error("[mobile/activity GET]", err);
    return Response.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
