import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  forbiddenResponse,
  getMobileAdminUser,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";
import { getWeddingAccess, hasUnassignedEvents } from "@/lib/wedding-access";
import { accessibleEventsWhere } from "@/lib/wedding-policy";
import { summarizeEventAttendance } from "@/lib/attendance";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** GET /admin/api/mobile/events */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const weddingFilter = req.nextUrl.searchParams.get("weddingId")?.trim() || null;
  const where: Prisma.EventWhereInput = {
    AND: [
      { deletedAt: null },
      accessibleEventsWhere(user),
      ...(weddingFilter ? [{ weddingId: weddingFilter }] : []),
    ],
  };

  try {
    const events = await withReconnect(() =>
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          weddingId: true,
          wedding: { select: { name: true } },
          title: true,
          slug: true,
          coupleNames: true,
          eventDate: true,
          rsvpDeadline: true,
          eventTime: true,
          venue: true,
          theme: true,
          imagePath: true,
          createdAt: true,
          guests: {
            where: { deletedAt: null },
            select: {
              attending: true,
              attendingCount: true,
              maxGuests: true,
              menCount: true,
              womenCount: true,
              kidsCount: true,
              respondedAt: true,
              invitedAt: true,
              excludedGuestCount: true,
              excludedMenCount: true,
              excludedWomenCount: true,
              excludedKidsCount: true,
              excludeFromTotals: true,
              excludeReason: true,
            },
          },
        },
      })
    );

    return Response.json({
      events: events.map((e) => {
        const a = summarizeEventAttendance(e.guests ?? []);
        const familyCount = a.households;
        const responded = a.respondedHouseholds;
        const attendingFamilies = a.attendingHouseholds;
        const confirmedAttendees = a.confirmedPeople;
        const pendingFamilies = a.awaitingReplyHouseholds;
        const totalHeadcount = a.invitedPeople;
        return {
          id: e.id,
          weddingId: e.weddingId,
          weddingName: e.wedding?.name ?? null,
          title: e.title,
          slug: e.slug,
          coupleNames: e.coupleNames,
          eventDate: e.eventDate?.toISOString() ?? null,
          rsvpDeadline: e.rsvpDeadline?.toISOString() ?? null,
          eventTime: e.eventTime,
          venue: e.venue,
          theme: e.theme,
          imagePath: e.imagePath ?? null,
          createdAt: e.createdAt.toISOString(),
          // Counts
          guestCount: familyCount,
          familyCount,
          totalHeadcount,
          responded,
          attendingFamilies,
          confirmedAttendees,
          pendingFamilies,
        };
      }),
    });
  } catch (err) {
    console.error("[mobile/events GET]", err);
    return Response.json({ error: "Failed to load events" }, { status: 500 });
  }
}

/** POST /admin/api/mobile/events */
export async function POST(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title as string | undefined)?.trim();
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  // Current app builds send weddingId. Compatibility for older builds (see docs in final report):
  // - exactly one wedding: that wedding (same as the web form's only choice);
  // - no wedding but existing unassigned events (pre-backfill accounts): legacy unassigned event;
  // - otherwise refuse, so new customers never get silently unassigned events.
  let weddingId: string | null = null;
  let weddingAssignment: "explicit" | "only_wedding" | "legacy_unassigned" = "explicit";
  const requestedWeddingId = typeof body.weddingId === "string" ? body.weddingId.trim() : "";
  if (requestedWeddingId) {
    const access = await getWeddingAccess(user, requestedWeddingId);
    if (access.status === "not_found") return notFoundResponse("Wedding not found");
    if (access.status === "forbidden") return forbiddenResponse();
    weddingId = access.wedding.id;
  } else {
    const memberships = await prisma.weddingMembership.findMany({
      where: { userId: user.id },
      select: { weddingId: true },
      take: 2,
    });
    if (memberships.length > 1) {
      return Response.json(
        { error: "Choose which wedding this event belongs to.", code: "wedding_required" },
        { status: 409 },
      );
    }
    if (memberships.length === 1) {
      weddingId = memberships[0]!.weddingId;
      weddingAssignment = "only_wedding";
    } else if (await hasUnassignedEvents(user)) {
      weddingAssignment = "legacy_unassigned";
    } else {
      return Response.json(
        { error: "Create a wedding on the web first, then add events to it.", code: "no_wedding" },
        { status: 409 },
      );
    }
  }

  try {
    const baseSlug = slugify(title);
    const slugCandidate = baseSlug || `event-${Date.now()}`;

    const event = await withReconnect(async () => {
      const existing = await prisma.event.findFirst({ where: { slug: slugCandidate } });
      const slug = existing ? `${slugCandidate}-${Date.now().toString(36)}` : slugCandidate;
      return prisma.event.create({
        data: {
          title,
          slug,
          ownerUserId: user.id,
          weddingId,
          coupleNames: (body.coupleNames as string | undefined)?.trim() || null,
          venue: (body.venue as string | undefined)?.trim() || null,
          eventDate: body.eventDate ? new Date(body.eventDate as string) : null,
          rsvpDeadline: body.rsvpDeadline ? new Date(body.rsvpDeadline as string) : null,
        },
        select: { id: true, title: true, slug: true, weddingId: true },
      });
    });

    return Response.json({ event, weddingAssignment }, { status: 201 });
  } catch (err) {
    console.error("[mobile/events POST]", err);
    return Response.json({ error: "Failed to create event" }, { status: 500 });
  }
}
