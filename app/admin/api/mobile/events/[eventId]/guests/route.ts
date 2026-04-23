import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /admin/api/mobile/events/[eventId]/guests
 *
 * Query params:
 *   q        — search string (name, phone, email, group)
 *   status   — "all" | "attending" | "declined" | "pending" | "invited" | "not_invited"
 *   page     — 1-based page number (default 1)
 *   limit    — items per page (default 50, max 200)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true, ownerUserId: true },
  });
  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  const guests = await prisma.guest.findMany({
    where: { eventId, deletedAt: null },
    orderBy: { guestName: "asc" },
    select: {
      id: true,
      guestName: true,
      greeting: true,
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
      lastReminderAt: true,
      phone: true,
      phoneCountryCode: true,
      email: true,
      group: true,
      tableName: true,
      notes: true,
      hostMessage: true,
      isFamilyInvite: true,
      excludeFromTotals: true,
      excludeReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Filter by search query
  let filtered = guests;
  if (q) {
    filtered = filtered.filter((g) => {
      const phone = [g.phoneCountryCode, g.phone].filter(Boolean).join("");
      return (
        g.guestName.toLowerCase().includes(q) ||
        (g.phone ?? "").includes(q) ||
        phone.includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.group ?? "").toLowerCase().includes(q)
      );
    });
  }

  // Filter by RSVP status
  if (status !== "all") {
    filtered = filtered.filter((g) => {
      switch (status) {
        case "attending": return g.attending === true;
        case "declined": return g.attending === false;
        case "pending": return !g.respondedAt;
        case "invited": return Boolean(g.invitedAt);
        case "not_invited": return !g.invitedAt;
        default: return true;
      }
    });
  }

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return Response.json({
    guests: paged.map((g) => ({
      id: g.id,
      guestName: g.guestName,
      greeting: g.greeting,
      menCount: g.menCount,
      womenCount: g.womenCount,
      kidsCount: g.kidsCount,
      maxGuests: g.maxGuests,
      attending: g.attending,
      attendingCount: g.attendingCount,
      respondedAt: g.respondedAt?.toISOString() ?? null,
      invitedAt: g.invitedAt?.toISOString() ?? null,
      inviteChannelLastUsed: g.inviteChannelLastUsed,
      inviteCount: g.inviteCount,
      lastReminderAt: g.lastReminderAt?.toISOString() ?? null,
      phone: g.phone,
      phoneCountryCode: g.phoneCountryCode,
      email: g.email,
      group: g.group,
      tableName: g.tableName,
      notes: g.notes,
      hostMessage: g.hostMessage,
      isFamilyInvite: g.isFamilyInvite,
      excludeFromTotals: g.excludeFromTotals,
      excludeReason: g.excludeReason,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
