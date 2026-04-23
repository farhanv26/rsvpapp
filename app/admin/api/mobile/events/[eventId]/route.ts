import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";

/** GET /admin/api/mobile/events/[eventId] — event detail with computed stats. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      coupleNames: true,
      eventSubtitle: true,
      eventDate: true,
      rsvpDeadline: true,
      eventTime: true,
      venue: true,
      theme: true,
      description: true,
      imagePath: true,
      ownerUserId: true,
      createdAt: true,
      guests: {
        where: { deletedAt: null },
        select: {
          id: true,
          guestName: true,
          menCount: true,
          womenCount: true,
          kidsCount: true,
          maxGuests: true,
          attending: true,
          attendingCount: true,
          respondedAt: true,
          invitedAt: true,
          inviteChannelLastUsed: true,
          inviteCount: true,
          phone: true,
          phoneCountryCode: true,
          email: true,
          group: true,
          tableName: true,
          excludeFromTotals: true,
          lastReminderAt: true,
        },
      },
    },
  });

  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  const counted = event.guests.filter((g) => !g.excludeFromTotals);
  const totalFamilies = event.guests.length;
  const countedFamilies = counted.length;
  const totalMaxInvited = counted.reduce((s, g) => {
    const sum = (g.menCount ?? 0) + (g.womenCount ?? 0) + (g.kidsCount ?? 0);
    return s + (sum > 0 ? sum : g.maxGuests);
  }, 0);
  const totalMen = counted.reduce((s, g) => s + (g.menCount ?? 0), 0);
  const totalWomen = counted.reduce((s, g) => s + (g.womenCount ?? 0), 0);
  const totalKids = counted.reduce((s, g) => s + (g.kidsCount ?? 0), 0);
  const invitedFamilies = counted.filter((g) => g.invitedAt).length;
  const totalResponded = counted.filter((g) => g.respondedAt).length;
  const totalPending = countedFamilies - totalResponded;
  const attendingFamilies = counted.filter((g) => g.attending === true).length;
  const declinedFamilies = counted.filter((g) => g.attending === false).length;
  const confirmedAttendees = counted.reduce((s, g) => s + (g.attendingCount ?? 0), 0);
  const responseRate = countedFamilies > 0 ? Math.round((totalResponded / countedFamilies) * 100) : 0;
  const notInvitedCount = counted.filter((g) => !g.invitedAt).length;
  const awaitingRsvpCount = counted.filter((g) => g.invitedAt && !g.respondedAt).length;

  return Response.json({
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      coupleNames: event.coupleNames,
      eventSubtitle: event.eventSubtitle,
      eventDate: event.eventDate?.toISOString() ?? null,
      rsvpDeadline: event.rsvpDeadline?.toISOString() ?? null,
      eventTime: event.eventTime,
      venue: event.venue,
      theme: event.theme,
      description: event.description,
      imagePath: event.imagePath,
      createdAt: event.createdAt.toISOString(),
    },
    stats: {
      totalFamilies,
      countedFamilies,
      totalMaxInvited,
      totalMen,
      totalWomen,
      totalKids,
      invitedFamilies,
      notInvitedCount,
      totalResponded,
      totalPending,
      awaitingRsvpCount,
      attendingFamilies,
      declinedFamilies,
      confirmedAttendees,
      responseRate,
    },
  });
}
