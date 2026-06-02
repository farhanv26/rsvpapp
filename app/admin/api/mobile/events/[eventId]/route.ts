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
      itinerary: true,
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
      itinerary: Array.isArray(event.itinerary) ? event.itinerary : [],
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

/** PUT /admin/api/mobile/events/[eventId] — update event fields. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const user = await getMobileAdminUser(req);
    if (!user) return unauthorizedResponse();

    const { eventId } = await params;

    const event = await withReconnect(() =>
      prisma.event.findFirst({
        where: { id: eventId, deletedAt: null },
        select: { id: true, title: true, ownerUserId: true },
      })
    );
    if (!event) return notFoundResponse("Event not found");
    if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.coupleNames === "string") data.coupleNames = body.coupleNames.trim() || null;
    if (typeof body.eventSubtitle === "string") data.eventSubtitle = body.eventSubtitle.trim() || null;
    if (typeof body.venue === "string") data.venue = body.venue.trim() || null;
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (typeof body.eventTime === "string") data.eventTime = body.eventTime.trim() || null;
    if (body.eventDate === null) { data.eventDate = null; }
    else if (typeof body.eventDate === "string") { data.eventDate = new Date(body.eventDate); }
    if (body.rsvpDeadline === null) { data.rsvpDeadline = null; }
    else if (typeof body.rsvpDeadline === "string") { data.rsvpDeadline = new Date(body.rsvpDeadline); }
    if (Array.isArray(body.itinerary)) data.itinerary = body.itinerary;

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data,
      select: {
        id: true, title: true, slug: true, coupleNames: true, eventSubtitle: true,
        eventDate: true, rsvpDeadline: true, eventTime: true, venue: true, description: true,
        imagePath: true, itinerary: true, createdAt: true, theme: true,
      },
    });

    await logAuditActivity({
      eventId,
      userId: user.id,
      userName: user.name,
      actionType: "event_updated",
      entityType: "Event",
      entityId: eventId,
      entityName: event.title,
      message: `${user.name} updated event "${event.title}" (mobile).`,
      metadata: { changes: Object.keys(data) },
    });

    return Response.json({
      event: {
        ...updated,
        eventDate: updated.eventDate?.toISOString() ?? null,
        rsvpDeadline: updated.rsvpDeadline?.toISOString() ?? null,
        itinerary: Array.isArray(updated.itinerary) ? updated.itinerary : [],
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[mobile/event PUT]", err);
    return Response.json({ error: "Failed to update event" }, { status: 500 });
  }
}

/** DELETE /admin/api/mobile/events/[eventId] — soft-delete event. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const user = await getMobileAdminUser(req);
    if (!user) return unauthorizedResponse();

    const { eventId } = await params;

    const event = await withReconnect(() =>
      prisma.event.findFirst({
        where: { id: eventId, deletedAt: null },
        select: { id: true, title: true, ownerUserId: true },
      })
    );
    if (!event) return notFoundResponse("Event not found");
    if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

    await prisma.event.update({ where: { id: eventId }, data: { deletedAt: new Date() } });

    await logAuditActivity({
      eventId,
      userId: user.id,
      userName: user.name,
      actionType: "event_deleted",
      entityType: "Event",
      entityId: eventId,
      entityName: event.title,
      message: `${user.name} deleted event "${event.title}" (mobile).`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[mobile/event DELETE]", err);
    return Response.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
