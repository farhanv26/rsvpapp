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
import { generateSecureToken } from "@/lib/security";
import {
  buildDuplicateStrengthMap,
} from "@/lib/guest-duplicates";

/**
 * GET /admin/api/mobile/events/[eventId]/guests
 *
 * Query params:
 *   q          — search string (name, phone, email, group)
 *   status     — "all" | "attending" | "declined" | "pending" | "invited" | "not_invited"
 *   readiness  — "ready" | "missing_contact" | "already_invited" | "responded"
 *   followup   — "1" to show only invited-but-not-responded
 *   duplicate  — "has_duplicates" | "strong" | "weak"
 *   sort       — "name_asc" (default) | "name_desc" | "status" | "last_action"
 *   page       — 1-based page number (default 1)
 *   limit      — items per page (default 50, max 200)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  try {
  const event = await withReconnect(() =>
    prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    })
  );
  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const status = searchParams.get("status") ?? "all";
  const readiness = searchParams.get("readiness") ?? "all";
  const followup = searchParams.get("followup") === "1";
  const duplicate = searchParams.get("duplicate") ?? "all";
  const sort = searchParams.get("sort") ?? "name_asc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  const orderBy: Record<string, "asc" | "desc"> =
    sort === "name_desc" ? { guestName: "desc" } :
    sort === "last_action" ? { updatedAt: "desc" } :
    { guestName: "asc" };

  const guests = await prisma.guest.findMany({
    where: { eventId, deletedAt: null },
    orderBy,
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
      excludedGuestCount: true,
      excludedMenCount: true,
      excludedWomenCount: true,
      excludedKidsCount: true,
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

  // Filter by readiness
  if (readiness !== "all") {
    const hasContact = (g: (typeof filtered)[0]) => !!(g.phone || g.email);
    filtered = filtered.filter((g) => {
      switch (readiness) {
        case "ready": return !g.invitedAt && !g.respondedAt && hasContact(g);
        case "missing_contact": return !hasContact(g);
        case "already_invited": return Boolean(g.invitedAt) && !g.respondedAt;
        case "responded": return Boolean(g.respondedAt);
        default: return true;
      }
    });
  }

  // Filter by follow-up (invited but no response)
  if (followup) {
    filtered = filtered.filter((g) => g.invitedAt && !g.respondedAt);
  }

  // Filter by duplicate
  if (duplicate !== "all") {
    const strengthMap = buildDuplicateStrengthMap(
      guests.map((g) => ({
        id: g.id,
        guestName: g.guestName,
        phone: g.phone,
        phoneCountryCode: g.phoneCountryCode,
        email: g.email,
      })),
    );
    filtered = filtered.filter((g) => {
      const strength = strengthMap.get(g.id) ?? "none";
      switch (duplicate) {
        case "has_duplicates": return strength !== "none";
        case "strong": return strength === "strong";
        case "weak": return strength === "weak";
        default: return true;
      }
    });
  }

  // Sort by status (attending → invited → declined → not_invited)
  if (sort === "status") {
    const statusOrder = (g: (typeof filtered)[0]) => {
      if (g.attending === true) return 0;
      if (g.attending === false) return 3;
      if (g.invitedAt) return 1;
      return 2;
    };
    filtered.sort((a, b) => statusOrder(a) - statusOrder(b) || a.guestName.localeCompare(b.guestName));
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
      excludedGuestCount: g.excludedGuestCount ?? 0,
      excludedMenCount: g.excludedMenCount ?? 0,
      excludedWomenCount: g.excludedWomenCount ?? 0,
      excludedKidsCount: g.excludedKidsCount ?? 0,
      excludeReason: g.excludeReason,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
  } catch (err) {
    console.error("[mobile/guests GET]", err);
    return Response.json({ error: "Failed to load guests" }, { status: 500 });
  }
}

/**
 * POST /admin/api/mobile/events/[eventId]/guests
 * Creates a new guest for the event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();

  const { eventId } = await params;

  const event = await withReconnect(() =>
    prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    })
  );
  if (!event) return notFoundResponse("Event not found");
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id) return forbiddenResponse();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";
  if (!guestName) return Response.json({ error: "guestName is required" }, { status: 400 });

  try {
  const menCount = typeof body.menCount === "number" ? Math.max(0, body.menCount) : 0;
  const womenCount = typeof body.womenCount === "number" ? Math.max(0, body.womenCount) : 0;
  const kidsCount = typeof body.kidsCount === "number" ? Math.max(0, body.kidsCount) : 0;
  const rawTotal = menCount + womenCount + kidsCount;
  const maxGuests = typeof body.maxGuests === "number"
    ? Math.max(1, body.maxGuests)
    : Math.max(1, rawTotal);

  const guest = await prisma.guest.create({
    data: {
      eventId,
      guestName,
      greeting: typeof body.greeting === "string" ? body.greeting.trim() || "Assalamu Alaikum" : "Assalamu Alaikum",
      menCount,
      womenCount,
      kidsCount,
      maxGuests,
      token: generateSecureToken(),
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      phoneCountryCode: typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() || null : null,
      email: typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null,
      group: typeof body.group === "string" ? body.group.trim() || null : null,
      tableName: typeof body.tableName === "string" ? body.tableName.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      isFamilyInvite: typeof body.isFamilyInvite === "boolean" ? body.isFamilyInvite : false,
    },
    select: {
      id: true, guestName: true, greeting: true,
      menCount: true, womenCount: true, kidsCount: true, maxGuests: true,
      attending: true, attendingCount: true, respondedAt: true,
      invitedAt: true, inviteChannelLastUsed: true, inviteCount: true, lastReminderAt: true,
      phone: true, phoneCountryCode: true, email: true,
      group: true, tableName: true, notes: true, hostMessage: true,
      isFamilyInvite: true, excludeFromTotals: true, excludedGuestCount: true, excludeReason: true,
      createdAt: true, updatedAt: true,
    },
  });

  await logAuditActivity({
    eventId,
    userId: user.id,
    userName: user.name,
    actionType: "guest_created",
    entityType: "Guest",
    entityId: guest.id,
    entityName: guest.guestName,
    message: `${user.name} added guest "${guest.guestName}" (mobile).`,
  });

  return Response.json(
    {
      guest: {
        ...guest,
        respondedAt: guest.respondedAt?.toISOString() ?? null,
        invitedAt: guest.invitedAt?.toISOString() ?? null,
        lastReminderAt: guest.lastReminderAt?.toISOString() ?? null,
        excludedGuestCount: guest.excludedGuestCount ?? 0,
        createdAt: guest.createdAt.toISOString(),
        updatedAt: guest.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
  } catch (err) {
    console.error("[mobile/guests POST]", err);
    return Response.json({ error: "Failed to create guest" }, { status: 500 });
  }
}
