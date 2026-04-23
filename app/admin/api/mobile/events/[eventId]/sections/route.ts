import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";
import { buildDuplicateClusters } from "@/lib/guest-duplicates";

type Params = { params: Promise<{ eventId: string }> };

/**
 * GET /admin/api/mobile/events/[eventId]/sections
 *
 * Returns pre-computed section data for the event dashboard:
 * - followUp: count of invited guests awaiting RSVP
 * - readiness: contact availability breakdown
 * - listHygiene: duplicate/missing-contact/send-ready counts
 * - communications: interaction stats (7d window)
 * - rsvpDeadline: deadline status alert
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      ownerUserId: true,
      rsvpDeadline: true,
      guests: {
        where: { deletedAt: null },
        select: {
          id: true,
          guestName: true,
          phone: true,
          phoneCountryCode: true,
          email: true,
          invitedAt: true,
          respondedAt: true,
          attending: true,
          excludeFromTotals: true,
          excludedGuestCount: true,
          excludedMenCount: true,
          excludedWomenCount: true,
          excludedKidsCount: true,
          menCount: true,
          womenCount: true,
          kidsCount: true,
          maxGuests: true,
          lastReminderAt: true,
        },
      },
    },
  });
  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  const guests = event.guests;
  const guestCountedTotal = (g: (typeof guests)[0]) => {
    const excMen = g.excludedMenCount ?? 0;
    const excWomen = g.excludedWomenCount ?? 0;
    const excKids = g.excludedKidsCount ?? 0;
    const catSum = excMen + excWomen + excKids;
    const rawMen = g.menCount ?? 0;
    const rawWomen = g.womenCount ?? 0;
    const rawKids = g.kidsCount ?? 0;
    const rawTotal = rawMen + rawWomen + rawKids > 0 ? rawMen + rawWomen + rawKids : g.maxGuests;
    if (catSum > 0) return Math.max(rawMen - excMen, 0) + Math.max(rawWomen - excWomen, 0) + Math.max(rawKids - excKids, 0);
    return Math.max(rawTotal - (g.excludedGuestCount ?? 0), 0);
  };
  const counted = guests.filter((g) => guestCountedTotal(g) > 0);

  // Follow-up
  const awaitingRsvp = counted.filter((g) => g.invitedAt && !g.respondedAt).length;

  // Readiness
  const hasPhone = (g: (typeof guests)[0]) => !!(g.phone);
  const hasEmail = (g: (typeof guests)[0]) => !!(g.email);
  const readyToSend = guests.filter(
    (g) => !g.invitedAt && !g.respondedAt && (hasPhone(g) || hasEmail(g)),
  ).length;
  const missingContact = guests.filter((g) => !g.invitedAt && !hasPhone(g) && !hasEmail(g)).length;
  const alreadyInvited = guests.filter((g) => g.invitedAt && !g.respondedAt).length;
  const responded = guests.filter((g) => g.respondedAt).length;

  // List hygiene — duplicate detection
  const duplicateClusters = buildDuplicateClusters(
    guests.map((g) => ({
      id: g.id,
      guestName: g.guestName,
      phone: g.phone,
      phoneCountryCode: g.phoneCountryCode,
      email: g.email,
    })),
  );
  const guestsInDuplicateClusters = new Set(
    duplicateClusters.flatMap((c) => c.guestIds),
  ).size;
  const missingContactCount = guests.filter((g) => !hasPhone(g) && !hasEmail(g)).length;
  const sendReadyCount = guests.filter((g) => !g.invitedAt && (hasPhone(g) || hasEmail(g))).length;

  // Communications (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalLogs, recentLogs, allLogGuestIds] = await Promise.all([
    prisma.guestCommunicationLog.count({ where: { eventId } }),
    prisma.guestCommunicationLog.count({
      where: { eventId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.guestCommunicationLog.findMany({
      where: { eventId },
      select: { guestId: true },
    }),
  ]);
  const guestsWithLogs = new Set(allLogGuestIds.map((r) => r.guestId)).size;

  // RSVP deadline status
  let deadlineStatus: "none" | "open" | "closing_soon" | "closes_today" | "closed" = "none";
  if (event.rsvpDeadline) {
    const now = new Date();
    const deadline = event.rsvpDeadline;
    const msUntil = deadline.getTime() - now.getTime();
    const daysUntil = msUntil / (1000 * 60 * 60 * 24);

    if (msUntil < 0) {
      deadlineStatus = "closed";
    } else if (daysUntil < 1) {
      deadlineStatus = "closes_today";
    } else if (daysUntil <= 3) {
      deadlineStatus = "closing_soon";
    } else {
      deadlineStatus = "open";
    }
  }

  return Response.json({
    followUp: {
      awaitingRsvp,
    },
    readiness: {
      readyToSend,
      missingContact,
      alreadyInvited,
      responded,
    },
    listHygiene: {
      possibleDuplicates: guestsInDuplicateClusters,
      duplicateClusters: duplicateClusters.length,
      missingContact: missingContactCount,
      sendReady: sendReadyCount,
    },
    communications: {
      totalLogs,
      recentLogs,
      guestsWithLogs,
      guestsWithoutLogs: guests.length - guestsWithLogs,
    },
    rsvpDeadline: {
      deadline: event.rsvpDeadline?.toISOString() ?? null,
      status: deadlineStatus,
    },
  });
  } catch (err) {
    console.error("[sections] Error:", err);
    return Response.json({ error: "Failed to load sections" }, { status: 500 });
  }
}
