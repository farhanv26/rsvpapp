import type { NextRequest } from "next/server";
import {
  authorizeMobileEvent,
  getMobileAdminUser,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";
import { summarizeEventAttendance } from "@/lib/attendance";

/** GET /admin/api/mobile/events/[eventId] — event detail with computed stats. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const authz = await authorizeMobileEvent(user, eventId);
  if (authz.error) return authz.error;

  const event = await withReconnect(() => prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      weddingId: true,
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
          excludeReason: true,
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

  const a = summarizeEventAttendance(event.guests);
  const totalFamilies = a.households;
  const countedFamilies = a.countedHouseholds;
  const totalMaxInvited = a.invitedPeople;
  const totalMen = a.men;
  const totalWomen = a.women;
  const totalKids = a.kids;
  const invitedFamilies = a.invitedHouseholds;
  const totalResponded = a.respondedHouseholds;
  const totalPending = a.pendingHouseholds;
  const attendingFamilies = a.attendingHouseholds;
  const declinedFamilies = a.declinedHouseholds;
  const confirmedAttendees = a.confirmedPeople;
  const responseRate = Math.round(a.responseRate * 100);
  const notInvitedCount = a.notInvitedHouseholds;
  const awaitingRsvpCount = a.awaitingReplyHouseholds;

  return Response.json({
    event: {
      id: event.id,
      weddingId: event.weddingId,
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

    const authz = await authorizeMobileEvent(user, eventId, { organizerOnly: true });
    if (authz.error) return authz.error;
    const event = authz.event;

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

    const authz = await authorizeMobileEvent(user, eventId, { organizerOnly: true });
    if (authz.error) return authz.error;
    const event = authz.event;

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
