import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";

/** GET /admin/api/mobile/events/[eventId] — event detail with computed stats. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await withReconnect(() => prisma.event.findFirst({
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
          excludedGuestCount: true,
          excludedMenCount: true,
          excludedWomenCount: true,
          excludedKidsCount: true,
          lastReminderAt: true,
        },
      },
    },
  }));

  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  const guestCountedBreakdown = (g: typeof event.guests[number]) => {
    const excMen = g.excludedMenCount ?? 0;
    const excWomen = g.excludedWomenCount ?? 0;
    const excKids = g.excludedKidsCount ?? 0;
    const catSum = excMen + excWomen + excKids;
    const rawMen = g.menCount ?? 0;
    const rawWomen = g.womenCount ?? 0;
    const rawKids = g.kidsCount ?? 0;
    const rawTotal = rawMen + rawWomen + rawKids > 0 ? rawMen + rawWomen + rawKids : g.maxGuests;
    if (catSum > 0) {
      const cMen = Math.max(rawMen - excMen, 0);
      const cWomen = Math.max(rawWomen - excWomen, 0);
      const cKids = Math.max(rawKids - excKids, 0);
      return { men: cMen, women: cWomen, kids: cKids, total: cMen + cWomen + cKids };
    }
    const legacyExcluded = g.excludedGuestCount ?? 0;
    return {
      men: legacyExcluded === 0 ? rawMen : 0,
      women: legacyExcluded === 0 ? rawWomen : 0,
      kids: legacyExcluded === 0 ? rawKids : 0,
      total: Math.max(rawTotal - legacyExcluded, 0),
    };
  };
  const counted = event.guests.filter((g) => guestCountedBreakdown(g).total > 0);
  const totalFamilies = event.guests.length;
  const countedFamilies = counted.length;
  const totalMaxInvited = event.guests.reduce((s, g) => s + guestCountedBreakdown(g).total, 0);
  const totalMen = event.guests.reduce((s, g) => s + guestCountedBreakdown(g).men, 0);
  const totalWomen = event.guests.reduce((s, g) => s + guestCountedBreakdown(g).women, 0);
  const totalKids = event.guests.reduce((s, g) => s + guestCountedBreakdown(g).kids, 0);
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
  } catch (err) {
    console.error("[event-detail] Error:", err);
    return Response.json({ error: "Failed to load event" }, { status: 500 });
  }
}
