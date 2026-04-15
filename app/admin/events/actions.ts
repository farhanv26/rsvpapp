"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { dispatchEventCommunication } from "@/lib/communications";
import { generateSecureToken } from "@/lib/security";
import { logGuestCommunication } from "@/lib/guest-communication-log";
import { buildGuestInviteCommunicationParts, buildGuestInviteEmailLines } from "@/lib/guest-invite-communication";
import { buildGuestRsvpAbsoluteUrl, getSafeImageSrc } from "@/lib/utils";
import { eventSchema, guestSchema } from "@/lib/validation";
import { sendEventOwnerNotificationEmail } from "@/lib/rsvp-email";
import {
  buildGuestRsvpReminderMessage,
  buildGuestWhatsAppInviteMessage,
  normalizePhoneForWhatsApp,
} from "@/lib/whatsapp";

function parseStoredImagePath(formData: FormData, key: string): string | null {
  return getSafeImageSrc(String(formData.get(key) ?? "")) ?? null;
}

function parseOptionalDate(value?: string) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPublicSiteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "";
}

function guestRsvpUrl(token: string) {
  const path = `/rsvp/${token}`;
  const origin = getPublicSiteOrigin();
  return origin ? `${origin}${path}` : path;
}

async function createUniqueSlug(baseTitle: string, eventId?: string) {
  const base = slugify(baseTitle) || "event";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.event.findFirst({
      where: {
        slug: candidate,
        ...(eventId ? { id: { not: eventId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

async function ensureEventAccess(eventId: string, mode: "view" | "manage" = "manage") {
  const admin = await requireCurrentAdminUser();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerUserId: true },
  });
  if (!event) {
    throw new Error("Event not found.");
  }
  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    if (mode === "view") {
      redirect("/admin/events");
    }
    throw new Error("You are not allowed to manage this event.");
  }
  return { admin, event };
}

export async function createEventAction(formData: FormData) {
  const admin = await requireCurrentAdminUser();
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    theme: formData.get("theme") || "modern",
    description: formData.get("description") || undefined,
    coupleNames: formData.get("coupleNames") || undefined,
    eventSubtitle: formData.get("eventSubtitle") || undefined,
    eventDate: formData.get("eventDate") || undefined,
    rsvpDeadline: formData.get("rsvpDeadline") || undefined,
    eventTime: formData.get("eventTime") || undefined,
    venue: formData.get("venue") || undefined,
    welcomeMessage: formData.get("welcomeMessage") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid event details.");
  }

  const imagePath = getSafeImageSrc(String(formData.get("imagePath") || "")) ?? null;
  const genericCardImage = parseStoredImagePath(formData, "genericCardImage");
  const cardImage1 = parseStoredImagePath(formData, "cardImage1");
  const cardImage2 = parseStoredImagePath(formData, "cardImage2");
  const cardImage3 = parseStoredImagePath(formData, "cardImage3");
  const cardImage4 = parseStoredImagePath(formData, "cardImage4");
  const familyCardImage = parseStoredImagePath(formData, "familyCardImage");
  console.info("[event-image] value to write on create", { imagePath });
  const slug = await createUniqueSlug(parsed.data.title);

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
      ownerUserId: admin.id,
      theme: parsed.data.theme,
      description: parsed.data.description || null,
      slug,
      imagePath,
      genericCardImage,
      cardImage1,
      cardImage2,
      cardImage3,
      cardImage4,
      familyCardImage,
      coupleNames: parsed.data.coupleNames || null,
      eventSubtitle: parsed.data.eventSubtitle || null,
      eventDate: parseOptionalDate(parsed.data.eventDate),
      rsvpDeadline: parseOptionalDate(parsed.data.rsvpDeadline),
      eventTime: parsed.data.eventTime || null,
      venue: parsed.data.venue || null,
      welcomeMessage: parsed.data.welcomeMessage || null,
    },
    select: { id: true },
  });

  await logAuditActivity({
    eventId: event.id,
    userId: admin.id,
    userName: admin.name,
    actionType: "event_created",
    entityType: "Event",
    entityId: event.id,
    entityName: parsed.data.title,
    message: `${admin.name} created event "${parsed.data.title}".`,
  });

  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}`);
}

export async function updateEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) {
    throw new Error("Event id is missing.");
  }

  const { admin } = await ensureEventAccess(eventId, "manage");
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    theme: formData.get("theme") || "modern",
    description: formData.get("description") || undefined,
    coupleNames: formData.get("coupleNames") || undefined,
    eventSubtitle: formData.get("eventSubtitle") || undefined,
    eventDate: formData.get("eventDate") || undefined,
    rsvpDeadline: formData.get("rsvpDeadline") || undefined,
    eventTime: formData.get("eventTime") || undefined,
    venue: formData.get("venue") || undefined,
    welcomeMessage: formData.get("welcomeMessage") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid event details.");
  }

  const imagePath = getSafeImageSrc(String(formData.get("imagePath") || "")) ?? null;
  if (imagePath) {
    console.info("[event-image] value to write on update", { eventId, imagePath });
  }
  const slug = await createUniqueSlug(parsed.data.title, eventId);

  const variantImages = {
    genericCardImage: parseStoredImagePath(formData, "genericCardImage"),
    cardImage1: parseStoredImagePath(formData, "cardImage1"),
    cardImage2: parseStoredImagePath(formData, "cardImage2"),
    cardImage3: parseStoredImagePath(formData, "cardImage3"),
    cardImage4: parseStoredImagePath(formData, "cardImage4"),
    familyCardImage: parseStoredImagePath(formData, "familyCardImage"),
  };

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      title: parsed.data.title,
      theme: parsed.data.theme,
      description: parsed.data.description || null,
      slug,
      coupleNames: parsed.data.coupleNames || null,
      eventSubtitle: parsed.data.eventSubtitle || null,
      eventDate: parseOptionalDate(parsed.data.eventDate),
      rsvpDeadline: parseOptionalDate(parsed.data.rsvpDeadline),
      eventTime: parsed.data.eventTime || null,
      venue: parsed.data.venue || null,
      welcomeMessage: parsed.data.welcomeMessage || null,
      ...(imagePath ? { imagePath } : {}),
      ...variantImages,
    },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "event_updated",
    entityType: "Event",
    entityId: eventId,
    entityName: parsed.data.title,
    message: `${admin.name} updated event "${parsed.data.title}".`,
  });
  if (updatedEvent.ownerUserId && updatedEvent.ownerUserId !== admin.id) {
    await dispatchEventCommunication({
      trigger: "event_updated",
      eventId,
      entityType: "Event",
      entityId: eventId,
      title: `Event "${updatedEvent.title}" was updated`,
      description: `${admin.name} updated event details.`,
      actorName: admin.name,
      metadata: {
        title: updatedEvent.title,
      },
    });
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function deleteEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) {
    return { ok: false, error: "Event id is missing." };
  }

  try {
    const { admin, event: existing } = await ensureEventAccess(eventId, "manage");

    if (!existing) {
      return { ok: false, error: "This event no longer exists." };
    }

    const beforeDelete = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, _count: { select: { guests: true } } },
    });

    await prisma.event.delete({
      where: { id: eventId },
    });

    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "event_deleted",
      entityType: "Event",
      entityId: eventId,
      entityName: beforeDelete?.title ?? "Deleted event",
      message: `${admin.name} deleted event "${beforeDelete?.title ?? "Unknown event"}".`,
      metadata: {
        guestCount: beforeDelete?._count.guests ?? 0,
      },
    });

    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${eventId}`);
    return { ok: true };
  } catch (error) {
    console.error("[admin/events] failed to delete event", {
      eventId,
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: "Could not delete event right now. Please try again." };
  }
}

export async function createGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) {
    throw new Error("Event id is missing.");
  }

  const { admin } = await ensureEventAccess(eventId, "manage");
  const parsed = guestSchema.safeParse({
    guestName: formData.get("guestName"),
    greeting: formData.get("greeting") || undefined,
    maxGuests: formData.get("maxGuests"),
    group: formData.get("group") || undefined,
    tableName: formData.get("tableName") || undefined,
    notes: formData.get("notes") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    isFamilyInvite: formData.get("isFamilyInvite"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const createdGuest = await prisma.guest.create({
    data: {
      eventId,
      guestName: parsed.data.guestName,
      greeting: parsed.data.greeting?.trim() || "Assalamu Alaikum",
      maxGuests: parsed.data.maxGuests,
      group: parsed.data.group ?? null,
      tableName: parsed.data.tableName?.trim() ? parsed.data.tableName.trim() : null,
      notes: parsed.data.notes ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email?.trim() || null,
      isFamilyInvite: parsed.data.isFamilyInvite ?? false,
      token: generateSecureToken(),
    },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_created",
    entityType: "Guest",
    entityId: createdGuest.id,
    entityName: createdGuest.guestName,
    message: `${admin.name} added guest "${createdGuest.guestName}".`,
    metadata: { maxGuests: createdGuest.maxGuests },
  });
  await dispatchEventCommunication({
    trigger: "guest_added",
    eventId,
    entityType: "Guest",
    entityId: createdGuest.id,
    title: `Guest "${createdGuest.guestName}" was added`,
    description: `Max guests: ${createdGuest.maxGuests}.`,
    guestName: createdGuest.guestName,
    attendingCount: createdGuest.maxGuests,
    actorName: admin.name,
    metadata: { maxGuests: createdGuest.maxGuests },
  });

  revalidatePath(`/admin/events/${eventId}`);
}

export async function updateGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const guestId = String(formData.get("guestId") || "");
  if (!eventId || !guestId) {
    throw new Error("Missing event or guest id.");
  }

  const { admin } = await ensureEventAccess(eventId, "manage");
  const parsed = guestSchema.safeParse({
    guestName: formData.get("guestName"),
    greeting: formData.get("greeting") || undefined,
    maxGuests: formData.get("maxGuests"),
    group: formData.get("group") || undefined,
    tableName: formData.get("tableName") || undefined,
    notes: formData.get("notes") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    isFamilyInvite: formData.get("isFamilyInvite"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const existing = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, guestName: true, maxGuests: true },
  });
  if (!existing) {
    throw new Error("Guest not found for this event.");
  }

  const updatedGuest = await prisma.guest.update({
    where: { id: guestId },
    data: {
      guestName: parsed.data.guestName,
      greeting: parsed.data.greeting?.trim() || "Assalamu Alaikum",
      maxGuests: parsed.data.maxGuests,
      group: parsed.data.group ?? null,
      tableName: parsed.data.tableName?.trim() ? parsed.data.tableName.trim() : null,
      notes: parsed.data.notes ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email?.trim() || null,
      isFamilyInvite: parsed.data.isFamilyInvite ?? false,
    },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_updated",
    entityType: "Guest",
    entityId: guestId,
    entityName: updatedGuest.guestName,
    message: `${admin.name} updated guest "${updatedGuest.guestName}".`,
    metadata: {
      previousName: existing.guestName,
      previousMaxGuests: existing.maxGuests,
      maxGuests: updatedGuest.maxGuests,
    },
  });
  await dispatchEventCommunication({
    trigger: "event_updated",
    eventId,
    entityType: "Guest",
    entityId: guestId,
    title: `Guest "${updatedGuest.guestName}" was updated`,
    description: `Updated by ${admin.name}.`,
    guestName: updatedGuest.guestName,
    actorName: admin.name,
    channels: { inApp: true, email: false },
  });

  revalidatePath(`/admin/events/${eventId}`);
}

export async function deleteGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const guestId = String(formData.get("guestId") || "");
  if (!eventId || !guestId) {
    throw new Error("Missing event or guest id.");
  }

  const { admin } = await ensureEventAccess(eventId, "manage");
  const existing = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, guestName: true, maxGuests: true },
  });
  if (!existing) {
    throw new Error("Guest not found for this event.");
  }

  await prisma.guest.delete({ where: { id: guestId } });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_deleted",
    entityType: "Guest",
    entityId: guestId,
    entityName: existing.guestName,
    message: `${admin.name} deleted guest "${existing.guestName}".`,
    metadata: { maxGuests: existing.maxGuests },
  });
  await dispatchEventCommunication({
    trigger: "guest_deleted",
    eventId,
    entityType: "Guest",
    entityId: guestId,
    title: `Guest "${existing.guestName}" was removed`,
    description: `Deleted by ${admin.name}.`,
    guestName: existing.guestName,
    actorName: admin.name,
    metadata: { maxGuests: existing.maxGuests },
  });

  revalidatePath(`/admin/events/${eventId}`);
}

export async function bulkDeleteGuestsAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const rawGuestIds = String(formData.get("guestIds") || "");
  if (!eventId) {
    throw new Error("Event id is missing.");
  }

  const { admin } = await ensureEventAccess(eventId, "manage");

  const guestIds = rawGuestIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (guestIds.length === 0) {
    return;
  }

  const matchedGuests = await prisma.guest.findMany({
    where: { eventId, id: { in: guestIds } },
    select: { id: true, guestName: true },
  });

  await prisma.guest.deleteMany({
    where: {
      eventId,
      id: { in: guestIds },
    },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_bulk_deleted",
    entityType: "Guest",
    entityId: eventId,
    entityName: "Bulk guest deletion",
    message: `${admin.name} deleted ${matchedGuests.length} guest(s).`,
    metadata: {
      guestIds: matchedGuests.map((g) => g.id),
      guestNames: matchedGuests.map((g) => g.guestName),
      count: matchedGuests.length,
    },
  });
  if (matchedGuests.length > 0) {
    await dispatchEventCommunication({
      trigger: "guest_deleted",
      eventId,
      entityType: "Guest",
      entityId: eventId,
      title: `${matchedGuests.length} guests were removed`,
      description: `Bulk deletion completed by ${admin.name}.`,
      actorName: admin.name,
      metadata: {
        count: matchedGuests.length,
      },
    });
  }

  revalidatePath(`/admin/events/${eventId}`);
}

export async function bulkUpdateGuestPlanningAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const rawIds = String(formData.get("guestIds") || "");
  const mode = String(formData.get("mode") || "");
  const valueRaw = formData.get("value");

  const guestIds = rawIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!eventId || guestIds.length === 0) {
    throw new Error("Missing event or guest ids.");
  }

  const { admin } = await ensureEventAccess(eventId, "manage");

  const data: { group?: string | null; tableName?: string | null } = {};
  if (mode === "assignGroup") {
    const v = valueRaw != null ? String(valueRaw).trim() : "";
    data.group = v.length > 0 ? v : null;
  } else if (mode === "assignTable") {
    const v = valueRaw != null ? String(valueRaw).trim() : "";
    data.tableName = v.length > 0 ? v : null;
  } else if (mode === "clearGroup") {
    data.group = null;
  } else if (mode === "clearTable") {
    data.tableName = null;
  } else {
    throw new Error("Invalid planning update mode.");
  }

  const result = await prisma.guest.updateMany({
    where: { eventId, id: { in: guestIds } },
    data,
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_updated",
    entityType: "Guest",
    entityId: eventId,
    entityName: "Bulk planning",
    message: `${admin.name} updated group/table for ${result.count} guest(s) (${mode}).`,
    metadata: { guestIds, mode, count: result.count },
  });

  revalidatePath(`/admin/events/${eventId}`);
}

export async function logGuestWhatsappPreparedAction(eventId: string, guestId: string) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, guestName: true, greeting: true, token: true, event: { select: { title: true } } },
  });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  const message = buildGuestWhatsAppInviteMessage({
    guestId: guest.id,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    rsvpLink: guestRsvpUrl(guest.token),
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "communication_whatsapp_prepared",
    entityType: "Guest",
    entityId: guest.id,
    entityName: guest.guestName,
    message: `${admin.name} prepared a WhatsApp invite for "${guest.guestName}".`,
    metadata: { messageLength: message.length },
  });
  await logGuestCommunication({
    eventId,
    guestId: guest.id,
    userId: admin.id,
    actorName: admin.name,
    channel: "whatsapp",
    actionKey: "whatsapp_prepared",
    label: "WhatsApp message prepared / opened",
    detail: message.length > 120 ? `${message.slice(0, 120)}…` : message,
    success: true,
  });
}

export async function logBulkWhatsappPreparedAction(eventId: string, guestIds: string[]) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const uniqueIds = Array.from(new Set(guestIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return;
  }
  const guests = await prisma.guest.findMany({
    where: { eventId, id: { in: uniqueIds } },
    select: { id: true, guestName: true },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "communication_whatsapp_bulk_prepared",
    entityType: "Guest",
    entityId: eventId,
    entityName: "WhatsApp bulk prep",
    message: `${admin.name} prepared WhatsApp invites for ${guests.length} guest(s).`,
    metadata: {
      count: guests.length,
      guestIds: guests.map((guest) => guest.id),
      guestNames: guests.map((guest) => guest.guestName),
    },
  });
  for (const g of guests) {
    await logGuestCommunication({
      eventId,
      guestId: g.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "whatsapp",
      actionKey: "whatsapp_bulk_prepared",
      label: "WhatsApp invite flow (bulk — message prepared)",
      success: true,
    });
  }
}

export async function sendGuestInviteEmailAction(eventId: string, guestId: string) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      id: true,
      guestName: true,
      email: true,
      greeting: true,
      token: true,
      event: { select: { id: true, title: true } },
    },
  });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  if (!guest.email?.trim()) {
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_skipped",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} skipped guest email invite for "${guest.guestName}" (no email on file).`,
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_invite_skipped",
      label: "Invite email not sent (no email on file)",
      success: false,
    });
    return { ok: true, skipped: true, reason: "missing_email" as const };
  }

  const rsvpLink = buildGuestRsvpAbsoluteUrl(guest.token);
  const { inviteText, emailSubject } = buildGuestInviteCommunicationParts({
    guestId: guest.id,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    rsvpLink,
  });

  try {
    await sendEventOwnerNotificationEmail({
      eventTitle: guest.event.title,
      to: guest.email,
      subject: emailSubject,
      lines: buildGuestInviteEmailLines(inviteText),
    });
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        invitedAt: new Date(),
        inviteChannelLastUsed: "email",
        inviteCount: { increment: 1 },
      },
    });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_sent",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} sent an email invite to "${guest.guestName}".`,
      metadata: { email: guest.email },
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_invite_sent",
      label: "Invite email sent",
      detail: emailSubject,
      success: true,
    });
    revalidatePath(`/admin/events/${eventId}`);
    return { ok: true, skipped: false };
  } catch (error) {
    console.error("[communication] failed to send guest invite email", {
      eventId,
      guestId: guest.id,
      email: guest.email,
      error,
    });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_failed",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} attempted email invite for "${guest.guestName}", but it failed.`,
      metadata: { email: guest.email },
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_invite_failed",
      label: "Invite email failed to send",
      success: false,
    });
    return { ok: false, skipped: false, reason: "send_failed" as const };
  }
}

export async function sendBulkGuestInviteEmailsAction(eventId: string, guestIds: string[]) {
  const uniqueIds = Array.from(new Set(guestIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: true, sent: 0, skippedMissingEmail: 0, failed: 0 };
  }

  let sent = 0;
  let skippedMissingEmail = 0;
  let failed = 0;
  for (const guestId of uniqueIds) {
    const result = await sendGuestInviteEmailAction(eventId, guestId);
    if (result.ok && !result.skipped) sent += 1;
    if (result.skipped) skippedMissingEmail += 1;
    if (!result.ok) failed += 1;
  }
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: failed === 0, sent, skippedMissingEmail, failed };
}

export async function sendGuestReminderEmailAction(eventId: string, guestId: string) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      id: true,
      guestName: true,
      email: true,
      greeting: true,
      token: true,
      invitedAt: true,
      respondedAt: true,
      event: { select: { id: true, title: true } },
    },
  });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  if (!guest.invitedAt || guest.respondedAt) {
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_skipped",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} skipped reminder email for "${guest.guestName}" (not in invited–pending RSVP state).`,
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_reminder_skipped",
      label: "Reminder email skipped (not eligible)",
      success: false,
    });
    return { ok: true, skipped: true, reason: "not_eligible" as const };
  }

  if (!guest.email?.trim()) {
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_skipped",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} skipped reminder email for "${guest.guestName}" (no email on file).`,
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_reminder_skipped",
      label: "Reminder email skipped (no email on file)",
      success: false,
    });
    return { ok: true, skipped: true, reason: "missing_email" as const };
  }

  const rsvpLink = guestRsvpUrl(guest.token);
  const reminderText = buildGuestRsvpReminderMessage({
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    rsvpLink,
  });

  try {
    await sendEventOwnerNotificationEmail({
      eventTitle: guest.event.title,
      to: guest.email,
      subject: `${guest.event.title} · RSVP reminder for ${guest.guestName}`,
      lines: [reminderText, "", "If you have questions, please reply to this message."],
    });
    const now = new Date();
    await prisma.guest.update({
      where: { id: guest.id },
      data: { lastReminderAt: now },
    });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_reminder_sent",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} sent an RSVP reminder email to "${guest.guestName}".`,
      metadata: { email: guest.email },
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_reminder_sent",
      label: "RSVP reminder email sent",
      detail: `${guest.event.title} · RSVP reminder for ${guest.guestName}`,
      success: true,
    });
    revalidatePath(`/admin/events/${eventId}`);
    return { ok: true, skipped: false };
  } catch (error) {
    console.error("[communication] failed to send guest reminder email", {
      eventId,
      guestId: guest.id,
      email: guest.email,
      error,
    });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "communication_email_guest_failed",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} attempted reminder email for "${guest.guestName}", but it failed.`,
      metadata: { email: guest.email },
    });
    await logGuestCommunication({
      eventId,
      guestId: guest.id,
      userId: admin.id,
      actorName: admin.name,
      channel: "email",
      actionKey: "email_reminder_failed",
      label: "Reminder email failed to send",
      success: false,
    });
    return { ok: false, skipped: false, reason: "send_failed" as const };
  }
}

export async function sendBulkGuestReminderEmailsAction(eventId: string, guestIds: string[]) {
  const uniqueIds = Array.from(new Set(guestIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: true, sent: 0, skippedMissingEmail: 0, skippedNotEligible: 0, failed: 0 };
  }

  let sent = 0;
  let skippedMissingEmail = 0;
  let skippedNotEligible = 0;
  let failed = 0;
  for (const guestId of uniqueIds) {
    const result = await sendGuestReminderEmailAction(eventId, guestId);
    if (result.ok && !result.skipped) sent += 1;
    if (result.skipped && result.reason === "missing_email") skippedMissingEmail += 1;
    if (result.skipped && result.reason === "not_eligible") skippedNotEligible += 1;
    if (!result.ok) failed += 1;
  }
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: failed === 0, sent, skippedMissingEmail, skippedNotEligible, failed };
}

export type ReminderChannelTracked = "whatsapp" | "manual";

export async function recordGuestRemindersSentAction(
  eventId: string,
  guestIds: string[],
  channel: ReminderChannelTracked,
) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const uniqueIds = Array.from(new Set(guestIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: true, updated: 0 };
  }

  const now = new Date();
  const eligible = await prisma.guest.findMany({
    where: {
      eventId,
      id: { in: uniqueIds },
      invitedAt: { not: null },
      respondedAt: null,
    },
    select: { id: true },
  });
  const eligibleIds = eligible.map((g) => g.id);
  if (eligibleIds.length === 0) {
    return { ok: true, updated: 0 };
  }

  const result = await prisma.guest.updateMany({
    where: { eventId, id: { in: eligibleIds } },
    data: { lastReminderAt: now },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_reminder_recorded",
    entityType: "Guest",
    entityId: eventId,
    entityName: "Reminder tracking",
    message: `${admin.name} recorded RSVP reminders for ${result.count} guest(s) (${channel}).`,
    metadata: { guestIds: eligibleIds, channel, count: result.count },
  });

  const commChannel = channel === "whatsapp" ? "whatsapp" : "manual";
  const reminderLabel =
    channel === "whatsapp"
      ? "Reminder recorded (WhatsApp / outside app)"
      : "Reminder recorded (manual / offline)";
  await prisma.guestCommunicationLog.createMany({
    data: eligibleIds.map((gid) => ({
      eventId,
      guestId: gid,
      userId: admin.id,
      actorName: admin.name,
      channel: commChannel,
      actionKey: "reminder_recorded",
      label: reminderLabel,
      success: true,
    })),
  });

  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, updated: result.count };
}

export type InviteChannelTracked = "whatsapp" | "email" | "manual";

export async function markGuestsInvitedAction(
  eventId: string,
  guestIds: string[],
  channel: InviteChannelTracked,
) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const uniqueIds = Array.from(new Set(guestIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: true, updated: 0 };
  }

  const now = new Date();
  const result = await prisma.guest.updateMany({
    where: { eventId, id: { in: uniqueIds } },
    data: {
      invitedAt: now,
      inviteChannelLastUsed: channel,
      inviteCount: { increment: 1 },
    },
  });

  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: "guest_invite_marked",
    entityType: "Guest",
    entityId: eventId,
    entityName: "Invite tracking",
    message: `${admin.name} marked ${result.count} guest(s) as invited (${channel}).`,
    metadata: { guestIds: uniqueIds, channel, count: result.count },
  });

  const inviteCommChannel =
    channel === "whatsapp" ? "whatsapp" : channel === "email" ? "email" : "manual";
  await prisma.guestCommunicationLog.createMany({
    data: uniqueIds.map((gid) => ({
      eventId,
      guestId: gid,
      userId: admin.id,
      actorName: admin.name,
      channel: inviteCommChannel,
      actionKey: "invite_marked",
      label: `Invite marked as sent (${channel})`,
      success: true,
    })),
  });

  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, updated: result.count };
}

export type GuestCommunicationPreviewPayload = {
  guestName: string;
  greeting: string;
  eventTitle: string;
  eventSubtitle: string | null;
  phone: string | null;
  email: string | null;
  hasEmail: boolean;
  whatsappMessage: string;
  rsvpLink: string;
  emailSubject: string;
  emailBody: string;
  whatsappDirectAvailable: boolean;
};

export async function getGuestCommunicationPreviewAction(eventId: string, guestId: string) {
  await ensureEventAccess(eventId, "manage");
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: {
      guestName: true,
      greeting: true,
      token: true,
      email: true,
      phone: true,
      event: { select: { title: true, eventSubtitle: true } },
    },
  });
  if (!guest) {
    return { ok: false as const, error: "Guest not found." };
  }

  const rsvpLink = buildGuestRsvpAbsoluteUrl(guest.token);
  const { inviteText, emailSubject, emailBody } = buildGuestInviteCommunicationParts({
    guestId: guestId,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    rsvpLink,
  });

  return {
    ok: true as const,
    preview: {
      guestName: guest.guestName,
      greeting: guest.greeting?.trim() || "Assalamu Alaikum",
      eventTitle: guest.event.title,
      eventSubtitle: guest.event.eventSubtitle,
      phone: guest.phone,
      email: guest.email,
      hasEmail: Boolean(guest.email?.trim()),
      whatsappMessage: inviteText,
      rsvpLink,
      emailSubject,
      emailBody,
      whatsappDirectAvailable: normalizePhoneForWhatsApp(guest.phone) !== null,
    } satisfies GuestCommunicationPreviewPayload,
  };
}

export type GuestCommunicationHistoryEntry = {
  id: string;
  channel: string;
  actionKey: string;
  label: string;
  detail: string | null;
  success: boolean;
  actorName: string | null;
  createdAt: string;
};

export type GuestCommunicationActionCategory =
  | "invite_marked"
  | "whatsapp"
  | "email_invite"
  | "email_reminder"
  | "reminder_recorded";

function guestCommunicationActionCategoryWhere(
  category: GuestCommunicationActionCategory | undefined,
): { actionKey: string | { in: string[] } } | undefined {
  if (!category) return undefined;
  if (category === "invite_marked") return { actionKey: "invite_marked" };
  if (category === "whatsapp") {
    return { actionKey: { in: ["whatsapp_prepared", "whatsapp_bulk_prepared"] } };
  }
  if (category === "email_invite") {
    return { actionKey: { in: ["email_invite_sent", "email_invite_failed", "email_invite_skipped"] } };
  }
  if (category === "email_reminder") {
    return {
      actionKey: { in: ["email_reminder_sent", "email_reminder_failed", "email_reminder_skipped"] },
    };
  }
  if (category === "reminder_recorded") return { actionKey: "reminder_recorded" };
  return undefined;
}

export async function getGuestCommunicationHistoryAction(
  eventId: string,
  guestId: string,
  options?: {
    channel?: string;
    limit?: number;
    actionCategory?: GuestCommunicationActionCategory | "all";
  },
) {
  await ensureEventAccess(eventId, "manage");
  const raw = options?.channel?.trim();
  const channel =
    raw && raw !== "all" && (raw === "whatsapp" || raw === "email" || raw === "manual") ? raw : undefined;

  const validActionCategories = new Set<GuestCommunicationActionCategory>([
    "invite_marked",
    "whatsapp",
    "email_invite",
    "email_reminder",
    "reminder_recorded",
  ]);
  const rawCat = options?.actionCategory;
  const actionCategory: GuestCommunicationActionCategory | undefined =
    rawCat && rawCat !== "all" && validActionCategories.has(rawCat as GuestCommunicationActionCategory)
      ? (rawCat as GuestCommunicationActionCategory)
      : undefined;
  const actionWhere = guestCommunicationActionCategoryWhere(actionCategory);

  const rows = await prisma.guestCommunicationLog.findMany({
    where: {
      eventId,
      guestId,
      ...(channel ? { channel } : {}),
      ...(actionWhere ? actionWhere : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 50, 100),
  });

  return {
    ok: true as const,
    entries: rows.map(
      (r): GuestCommunicationHistoryEntry => ({
        id: r.id,
        channel: r.channel,
        actionKey: r.actionKey,
        label: r.label,
        detail: r.detail,
        success: r.success,
        actorName: r.actorName,
        createdAt: r.createdAt.toISOString(),
      }),
    ),
  };
}
