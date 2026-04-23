import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";

type Params = { params: Promise<{ eventId: string; guestId: string }> };

async function resolveAndAuthorize(req: NextRequest, eventId: string, guestId: string) {
  const user = await getMobileAdminUser(req);
  if (!user) return { error: unauthorizedResponse() };

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true, ownerUserId: true },
  });
  if (!event) return { error: notFoundResponse("Event not found") };
  if (!isMobileSuperAdmin(user) && event.ownerUserId !== user.id)
    return { error: forbiddenResponse() };

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId, deletedAt: null },
    select: {
      id: true, guestName: true, greeting: true,
      menCount: true, womenCount: true, kidsCount: true, maxGuests: true,
      attending: true, attendingCount: true, respondedAt: true,
      invitedAt: true, inviteChannelLastUsed: true, inviteCount: true, lastReminderAt: true,
      phone: true, phoneCountryCode: true, email: true,
      group: true, tableName: true, notes: true, hostMessage: true,
      isFamilyInvite: true, excludeFromTotals: true, excludedGuestCount: true,
      excludedMenCount: true, excludedWomenCount: true, excludedKidsCount: true,
      excludeReason: true,
      createdAt: true, updatedAt: true,
    },
  });
  if (!guest) return { error: notFoundResponse("Guest not found") };

  return { user, event, guest };
}

type GuestSelectResult = {
  id: string; guestName: string; greeting: string;
  menCount: number; womenCount: number; kidsCount: number; maxGuests: number;
  attending: boolean | null; attendingCount: number | null;
  respondedAt: Date | null; invitedAt: Date | null;
  inviteChannelLastUsed: string | null; inviteCount: number;
  lastReminderAt: Date | null; phone: string | null;
  phoneCountryCode: string | null; email: string | null;
  group: string | null; tableName: string | null;
  notes: string | null; hostMessage: string | null;
  isFamilyInvite: boolean; excludeFromTotals: boolean;
  excludedGuestCount: number; excludedMenCount: number; excludedWomenCount: number; excludedKidsCount: number;
  excludeReason: string | null;
  createdAt: Date; updatedAt: Date;
};

function serializeGuest(g: GuestSelectResult) {
  return {
    ...g,
    respondedAt: g.respondedAt?.toISOString() ?? null,
    invitedAt: g.invitedAt?.toISOString() ?? null,
    lastReminderAt: g.lastReminderAt?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

/**
 * PUT /admin/api/mobile/events/[eventId]/guests/[guestId]
 * Updates editable guest fields.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const { eventId, guestId } = await params;
  const resolved = await resolveAndAuthorize(req, eventId, guestId);
  if ("error" in resolved) return resolved.error;
  const { user, guest } = resolved;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.guestName === "string" && body.guestName.trim()) {
    data.guestName = body.guestName.trim();
  }
  if (typeof body.greeting === "string") data.greeting = body.greeting.trim() || "Assalamu Alaikum";
  if (typeof body.menCount === "number") data.menCount = Math.max(0, body.menCount);
  if (typeof body.womenCount === "number") data.womenCount = Math.max(0, body.womenCount);
  if (typeof body.kidsCount === "number") data.kidsCount = Math.max(0, body.kidsCount);
  if (typeof body.maxGuests === "number") data.maxGuests = Math.max(1, body.maxGuests);
  if (typeof body.phone === "string") data.phone = body.phone.trim() || null;
  if (typeof body.phoneCountryCode === "string") data.phoneCountryCode = body.phoneCountryCode.trim() || null;
  if (typeof body.email === "string") data.email = body.email.trim().toLowerCase() || null;
  if (typeof body.group === "string") data.group = body.group.trim() || null;
  if (typeof body.tableName === "string") data.tableName = body.tableName.trim() || null;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.hostMessage === "string") data.hostMessage = body.hostMessage.trim() || null;
  if (typeof body.isFamilyInvite === "boolean") data.isFamilyInvite = body.isFamilyInvite;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.guest.update({
    where: { id: guestId },
    data,
    select: {
      id: true, guestName: true, greeting: true,
      menCount: true, womenCount: true, kidsCount: true, maxGuests: true,
      attending: true, attendingCount: true, respondedAt: true,
      invitedAt: true, inviteChannelLastUsed: true, inviteCount: true, lastReminderAt: true,
      phone: true, phoneCountryCode: true, email: true,
      group: true, tableName: true, notes: true, hostMessage: true,
      isFamilyInvite: true, excludeFromTotals: true, excludedGuestCount: true,
      excludedMenCount: true, excludedWomenCount: true, excludedKidsCount: true,
      excludeReason: true,
      createdAt: true, updatedAt: true,
    },
  });

  await logAuditActivity({
    eventId,
    userId: user.id,
    userName: user.name,
    actionType: "guest_updated",
    entityType: "Guest",
    entityId: guestId,
    entityName: guest.guestName,
    message: `${user.name} updated guest "${guest.guestName}" (mobile).`,
    metadata: { changes: Object.keys(data) },
  });

  return Response.json({ guest: serializeGuest(updated) });
}

/**
 * DELETE /admin/api/mobile/events/[eventId]/guests/[guestId]
 * Soft-deletes the guest.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { eventId, guestId } = await params;
  const resolved = await resolveAndAuthorize(req, eventId, guestId);
  if ("error" in resolved) return resolved.error;
  const { user, guest } = resolved;

  await prisma.guest.update({
    where: { id: guestId },
    data: { deletedAt: new Date() },
  });

  await logAuditActivity({
    eventId,
    userId: user.id,
    userName: user.name,
    actionType: "guest_deleted",
    entityType: "Guest",
    entityId: guestId,
    entityName: guest.guestName,
    message: `${user.name} deleted guest "${guest.guestName}" (mobile).`,
  });

  return Response.json({ ok: true });
}
