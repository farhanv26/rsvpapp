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
import { notifyEventOwner, notifyUser } from "@/lib/notifications";
import { buildGuestRsvpAbsoluteUrl, getSafeImageSrc } from "@/lib/utils";
import { eventSchema, guestSchema } from "@/lib/validation";
import { sendEventOwnerNotificationEmail } from "@/lib/rsvp-email";
import {
  buildGuestInviteMessageParts,
  buildGuestRsvpReminderMessage,
  buildGuestWhatsAppInviteMessage,
  normalizePhoneForWhatsAppGuestRecord,
} from "@/lib/whatsapp";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";

function parseGuestPhoneFromForm(formData: FormData): { phone: string | null; phoneCountryCode: string | null } {
  const national = String(formData.get("phone") ?? "").replace(/\D/g, "");
  const cc = String(formData.get("phoneCountryCode") ?? "").trim();
  if (!national) {
    return { phone: null, phoneCountryCode: null };
  }
  return {
    phone: national,
    phoneCountryCode: cc || DEFAULT_PHONE_COUNTRY,
  };
}

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
    inviteFontStyle: formData.get("inviteFontStyle") || "elegant_serif",
    inviteMessageIntro: formData.get("inviteMessageIntro") || undefined,
    inviteMessageLineOverride: formData.get("inviteMessageLineOverride") || undefined,
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
      inviteFontStyle: parsed.data.inviteFontStyle || "elegant_serif",
      inviteMessageIntro: parsed.data.inviteMessageIntro || null,
      inviteMessageLineOverride: parsed.data.inviteMessageLineOverride || null,
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
  await notifyUser({
    userId: admin.id,
    type: "EVENT_CREATED",
    title: `New event: ${parsed.data.title}`,
    description: "Add guests, upload invite cards, and start sending when you are ready.",
    entityType: "Event",
    entityId: event.id,
    eventId: event.id,
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
    inviteFontStyle: formData.get("inviteFontStyle") || "elegant_serif",
    inviteMessageIntro: formData.get("inviteMessageIntro") || undefined,
    inviteMessageLineOverride: formData.get("inviteMessageLineOverride") || undefined,
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
      inviteFontStyle: parsed.data.inviteFontStyle || "elegant_serif",
      inviteMessageIntro: parsed.data.inviteMessageIntro || null,
      inviteMessageLineOverride: parsed.data.inviteMessageLineOverride || null,
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
      title: `${updatedEvent.coupleNames?.trim() || updatedEvent.title} — event details updated`,
      description: `${admin.name} saved changes to ceremony text, cards, or schedule — take a look when you can.`,
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
    await notifyUser({
      userId: admin.id,
      type: "EVENT_DELETED",
      title: `Deleted event: ${beforeDelete?.title ?? "Unknown event"}`,
      description:
        beforeDelete && beforeDelete._count.guests > 0
          ? `Permanently removed with ${beforeDelete._count.guests} guest/family record(s), RSVPs, and related logs.`
          : `Permanently removed by ${admin.name}.`,
      entityType: "Event",
      entityId: eventId,
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
  const greetingPreset = String(formData.get("greetingPreset") || "").trim();
  const greetingCustom = String(formData.get("greetingCustom") || "").trim();
  const greetingValue = greetingCustom || greetingPreset || String(formData.get("greeting") || "").trim() || undefined;
  const phoneParsed = parseGuestPhoneFromForm(formData);
  const parsed = guestSchema.safeParse({
    guestName: formData.get("guestName"),
    greeting: greetingValue,
    menCount: formData.get("menCount"),
    womenCount: formData.get("womenCount"),
    kidsCount: formData.get("kidsCount"),
    group: formData.get("group") || undefined,
    tableName: formData.get("tableName") || undefined,
    notes: formData.get("notes") || undefined,
    phoneCountryCode: phoneParsed.phoneCountryCode ?? undefined,
    phone: phoneParsed.phone ?? undefined,
    email: formData.get("email") || undefined,
    isFamilyInvite: formData.get("isFamilyInvite"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const createdGuest = await prisma.guest.create({
    // Keep maxGuests in sync for backward-compatible RSVP logic.
    data: {
      eventId,
      guestName: parsed.data.guestName,
      greeting: parsed.data.greeting?.trim() || "Assalamu Alaikum",
      menCount: parsed.data.menCount,
      womenCount: parsed.data.womenCount,
      kidsCount: parsed.data.kidsCount,
      maxGuests: parsed.data.menCount + parsed.data.womenCount + parsed.data.kidsCount,
      group: parsed.data.group ?? null,
      tableName: parsed.data.tableName?.trim() ? parsed.data.tableName.trim() : null,
      notes: parsed.data.notes ?? null,
      phoneCountryCode: parsed.data.phoneCountryCode ?? null,
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
    metadata: { maxGuests: createdGuest.maxGuests, menCount: createdGuest.menCount, womenCount: createdGuest.womenCount, kidsCount: createdGuest.kidsCount },
  });
  const eventLabel = (await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, coupleNames: true },
  })) ?? { title: "", coupleNames: null as string | null };
  const eventDisplay = eventLabel.coupleNames?.trim() || eventLabel.title || "your event";

  await dispatchEventCommunication({
    trigger: "guest_added",
    eventId,
    entityType: "Guest",
    entityId: createdGuest.id,
    title: `${createdGuest.guestName} added to ${eventDisplay}`,
    description: `${admin.name} added this family (${createdGuest.maxGuests} max invited · ${createdGuest.menCount} men, ${createdGuest.womenCount} women, ${createdGuest.kidsCount} kids).`,
    guestName: createdGuest.guestName,
    attendingCount: createdGuest.maxGuests,
    actorName: admin.name,
    metadata: { maxGuests: createdGuest.maxGuests, menCount: createdGuest.menCount, womenCount: createdGuest.womenCount, kidsCount: createdGuest.kidsCount },
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
  const greetingPreset = String(formData.get("greetingPreset") || "").trim();
  const greetingCustom = String(formData.get("greetingCustom") || "").trim();
  const greetingValue = greetingCustom || greetingPreset || String(formData.get("greeting") || "").trim() || undefined;
  const phoneParsed = parseGuestPhoneFromForm(formData);
  const parsed = guestSchema.safeParse({
    guestName: formData.get("guestName"),
    greeting: greetingValue,
    menCount: formData.get("menCount"),
    womenCount: formData.get("womenCount"),
    kidsCount: formData.get("kidsCount"),
    group: formData.get("group") || undefined,
    tableName: formData.get("tableName") || undefined,
    notes: formData.get("notes") || undefined,
    phoneCountryCode: phoneParsed.phoneCountryCode ?? undefined,
    phone: phoneParsed.phone ?? undefined,
    email: formData.get("email") || undefined,
    isFamilyInvite: formData.get("isFamilyInvite"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const existing = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, guestName: true, maxGuests: true, menCount: true, womenCount: true, kidsCount: true },
  });
  if (!existing) {
    throw new Error("Guest not found for this event.");
  }

  const updatedGuest = await prisma.guest.update({
    where: { id: guestId },
    data: {
      guestName: parsed.data.guestName,
      greeting: parsed.data.greeting?.trim() || "Assalamu Alaikum",
      menCount: parsed.data.menCount,
      womenCount: parsed.data.womenCount,
      kidsCount: parsed.data.kidsCount,
      maxGuests: parsed.data.menCount + parsed.data.womenCount + parsed.data.kidsCount,
      group: parsed.data.group ?? null,
      tableName: parsed.data.tableName?.trim() ? parsed.data.tableName.trim() : null,
      notes: parsed.data.notes ?? null,
      phoneCountryCode: parsed.data.phoneCountryCode ?? null,
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
      menCount: updatedGuest.menCount,
      womenCount: updatedGuest.womenCount,
      kidsCount: updatedGuest.kidsCount,
    },
  });
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, coupleNames: true },
  });
  const eventDisplay = ev?.coupleNames?.trim() || ev?.title || "your event";
  await dispatchEventCommunication({
    trigger: "event_updated",
    eventId,
    entityType: "Guest",
    entityId: guestId,
    title: `${updatedGuest.guestName} · guest details updated`,
    description: `${admin.name} saved changes for ${eventDisplay}.`,
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

  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, coupleNames: true },
  });
  const eventDisplay = ev?.coupleNames?.trim() || ev?.title || "your event";

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
    title: `Guest removed from ${eventDisplay}`,
    description: `${existing.guestName} was deleted by ${admin.name}. RSVP and invite history for this guest are gone.`,
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

  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, coupleNames: true },
  });
  const eventDisplay = ev?.coupleNames?.trim() || ev?.title || "your event";

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
    const sample = matchedGuests
      .slice(0, 3)
      .map((g) => g.guestName)
      .join(", ");
    const more = matchedGuests.length > 3 ? ` (+${matchedGuests.length - 3} more)` : "";
    await dispatchEventCommunication({
      trigger: "guest_deleted",
      eventId,
      entityType: "Guest",
      entityId: eventId,
      title: `${matchedGuests.length} guests removed from ${eventDisplay}`,
      description: `${admin.name} bulk-deleted: ${sample}${more}.`,
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
    select: {
      id: true,
      guestName: true,
      greeting: true,
      token: true,
      event: {
        select: { title: true, coupleNames: true, inviteMessageIntro: true, inviteMessageLineOverride: true },
      },
    },
  });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  const message = buildGuestWhatsAppInviteMessage({
    guestId: guest.id,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    coupleNames: guest.event.coupleNames,
    customIntroLine: guest.event.inviteMessageIntro,
    customLineOverride: guest.event.inviteMessageLineOverride,
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
      event: {
        select: { id: true, title: true, coupleNames: true, inviteMessageIntro: true, inviteMessageLineOverride: true },
      },
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
    coupleNames: guest.event.coupleNames,
    rsvpLink,
    customIntroLine: guest.event.inviteMessageIntro,
    customLineOverride: guest.event.inviteMessageLineOverride,
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
  if (result.count > 0) {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, coupleNames: true },
    });
    const eventDisplay = ev?.coupleNames?.trim() || ev?.title || "your event";
    await dispatchEventCommunication({
      trigger: "event_updated",
      eventId,
      entityType: "Guest",
      entityId: eventId,
      title: `${result.count} guest${result.count === 1 ? "" : "s"} still need follow-up · ${eventDisplay}`,
      description: `${admin.name} logged RSVP reminders (${channel === "whatsapp" ? "WhatsApp" : "manual / offline"}).`,
      actorName: admin.name,
      channels: { inApp: true, email: false },
      metadata: { guestIds: eligibleIds, count: result.count, channel, manualInviteTracking: true },
    });
  }

  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, updated: result.count };
}

export type InviteChannelTracked = "whatsapp" | "email" | "manual" | "imessage";

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
    channel === "whatsapp" ? "whatsapp" : channel === "email" ? "email" : channel === "imessage" ? "manual" : "manual";
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

  if (result.count > 0) {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, coupleNames: true },
    });
    const eventDisplay = ev?.coupleNames?.trim() || ev?.title || "your event";
    const named = await prisma.guest.findMany({
      where: { eventId, id: { in: uniqueIds } },
      select: { guestName: true },
      take: 4,
    });
    const sample = named.map((g) => g.guestName).join(", ");
    const more = result.count > named.length ? ` +${result.count - named.length} more` : "";
    await notifyEventOwner({
      eventId,
      type: "GUEST_INVITE_MARKED",
      title:
        result.count === 1 && named[0]
          ? `“${named[0].guestName}” was marked invited · ${eventDisplay}`
          : `${result.count} guests marked invited · ${eventDisplay}`,
      description: `${admin.name} via ${channel}.${sample ? ` Includes: ${sample}${more}.` : ""}`,
      entityType: "Guest",
      entityId: eventId,
    });
  }

  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, updated: result.count };
}

export async function markGuestsUninvitedAction(eventId: string, guestIds: string[]) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const uniqueIds = Array.from(new Set(guestIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: true as const, updated: 0 };
  }

  const eventRow = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, coupleNames: true },
  });
  const eventDisplay = eventRow?.coupleNames?.trim() || eventRow?.title || "this event";

  const guests = await prisma.guest.findMany({
    where: { eventId, id: { in: uniqueIds } },
    select: { id: true, guestName: true, invitedAt: true },
  });
  const previouslyInvited = guests.filter((g) => g.invitedAt);

  const result = await prisma.guest.updateMany({
    where: { eventId, id: { in: uniqueIds } },
    data: {
      invitedAt: null,
      inviteChannelLastUsed: null,
      lastReminderAt: null,
      inviteCount: 0,
    },
  });

  if (result.count > 0) {
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "guest_invite_cleared",
      entityType: "Guest",
      entityId: eventId,
      entityName: "Invite reset",
      message: `${admin.name} set ${result.count} guest(s) back to uninvited.`,
      metadata: { guestIds: uniqueIds, count: result.count },
    });

    await prisma.guestCommunicationLog.createMany({
      data: uniqueIds.map((gid) => ({
        eventId,
        guestId: gid,
        userId: admin.id,
        actorName: admin.name,
        channel: "manual",
        actionKey: "invite_cleared",
        label: "Invite status reset to uninvited",
        detail: "Invite timestamp cleared; RSVP responses on file were not changed.",
        success: true,
      })),
    });

    const sample = previouslyInvited
      .slice(0, 3)
      .map((g) => g.guestName)
      .join(", ");
    const more = previouslyInvited.length > 3 ? ` +${previouslyInvited.length - 3} more` : "";

    await notifyEventOwner({
      eventId,
      type: "GUEST_INVITE_CLEARED",
      title:
        result.count === 1 && previouslyInvited[0]
          ? `“${previouslyInvited[0].guestName}” set back to uninvited`
          : `${result.count} guests set back to uninvited`,
      description: `${eventDisplay} — ${admin.name} cleared invite tracking.${sample ? ` Includes: ${sample}${more}.` : ""} Existing RSVPs were left unchanged.`,
      entityType: "Guest",
      entityId: previouslyInvited[0]?.id ?? uniqueIds[0] ?? eventId,
    });
  }

  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true as const, updated: result.count };
}

export async function triggerGuestSendAction(
  eventId: string,
  guestId: string,
  channel: "whatsapp" | "imessage",
) {
  const { admin } = await ensureEventAccess(eventId, "manage");
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, guestName: true, invitedAt: true },
  });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }
  const now = new Date();
  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      invitedAt: guest.invitedAt ?? now,
      inviteChannelLastUsed: channel,
      inviteCount: { increment: 1 },
    },
  });
  await logAuditActivity({
    eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: channel === "whatsapp" ? "communication_whatsapp_prepared" : "communication_imessage_prepared",
    entityType: "Guest",
    entityId: guest.id,
    entityName: guest.guestName,
    message:
      channel === "whatsapp"
        ? `${admin.name} opened a WhatsApp invite for "${guest.guestName}".`
        : `${admin.name} opened a Message/iMessage invite for "${guest.guestName}".`,
  });
  await logGuestCommunication({
    eventId,
    guestId: guest.id,
    userId: admin.id,
    actorName: admin.name,
    channel: channel === "whatsapp" ? "whatsapp" : "manual",
    actionKey: channel === "whatsapp" ? "whatsapp_prepared" : "imessage_prepared",
    label:
      channel === "whatsapp"
        ? "WhatsApp message prepared / opened"
        : "Message / iMessage compose opened",
    success: true,
  });
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true as const };
}

export async function recordGuestManualRsvpAction(input: {
  eventId: string;
  guestId: string;
  attending: "yes" | "no";
  attendingCount?: number | null;
  attendeeNames?: string | null;
  note?: string | null;
  markInvitedIfMissing?: boolean;
}) {
  const { admin } = await ensureEventAccess(input.eventId, "manage");
  const guest = await prisma.guest.findFirst({
    where: { id: input.guestId, eventId: input.eventId },
    select: {
      id: true,
      guestName: true,
      maxGuests: true,
      invitedAt: true,
      attending: true,
      attendingCount: true,
      respondedAt: true,
      event: { select: { title: true, coupleNames: true } },
    },
  });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  const nextAttending = input.attending === "yes";
  const nextAttendingCount = nextAttending ? Number(input.attendingCount ?? 0) : 0;
  if (nextAttending && (!Number.isFinite(nextAttendingCount) || nextAttendingCount < 1 || nextAttendingCount > guest.maxGuests)) {
    throw new Error(`Attending count must be between 1 and ${guest.maxGuests}.`);
  }

  const attendeeNames = input.attendeeNames?.trim() || null;
  const note = input.note?.trim() || null;
  const now = new Date();
  const shouldMarkInvited = Boolean(input.markInvitedIfMissing && !guest.invitedAt);

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      attending: nextAttending,
      attendingCount: nextAttending ? nextAttendingCount : null,
      respondedAt: now,
      ...(shouldMarkInvited
        ? {
            invitedAt: now,
            inviteChannelLastUsed: "manual",
            inviteCount: { increment: 1 },
          }
        : {}),
    },
  });

  const details: string[] = ["Recorded manually by admin"];
  if (attendeeNames) details.push(`Attendees: ${attendeeNames}`);
  if (note) details.push(`Note: ${note}`);

  const wasResponded = Boolean(guest.respondedAt);
  await prisma.rsvpActivity.create({
    data: {
      eventId: input.eventId,
      guestId: guest.id,
      type: wasResponded ? "admin_updated_rsvp" : "admin_recorded_rsvp",
      description: nextAttending
        ? `${admin.name} recorded RSVP for ${guest.guestName}: attending (${nextAttendingCount}).`
        : `${admin.name} recorded RSVP for ${guest.guestName}: declined.`,
    },
  });

  await logAuditActivity({
    eventId: input.eventId,
    userId: admin.id,
    userName: admin.name,
    actionType: wasResponded ? "rsvp_updated" : "rsvp_submitted",
    entityType: "RSVP",
    entityId: guest.id,
    entityName: guest.guestName,
    message: `${admin.name} recorded RSVP manually for "${guest.guestName}" (${nextAttending ? `${nextAttendingCount} attending` : "declined"}).`,
    metadata: {
      manual: true,
      attending: nextAttending,
      attendingCount: nextAttending ? nextAttendingCount : 0,
      attendeeNames,
      note,
      markedInvited: shouldMarkInvited,
      respondedAt: now.toISOString(),
    },
  });

  const eventDisplay =
    guest.event.coupleNames?.trim() || guest.event.title || "this event";
  await dispatchEventCommunication({
    trigger: wasResponded ? "rsvp_updated" : "rsvp_submitted",
    eventId: input.eventId,
    entityType: "RSVP",
    entityId: guest.id,
    title: nextAttending
      ? `${guest.guestName} — ${nextAttendingCount} attending · ${eventDisplay}`
      : `${guest.guestName} declined · ${eventDisplay}`,
    description: `${admin.name} recorded this RSVP manually.${wasResponded ? " (updated)" : ""}`,
    guestName: guest.guestName,
    attendingLabel: nextAttending ? "Attending" : "Declined",
    attendingCount: nextAttending ? nextAttendingCount : null,
    actorName: admin.name,
    metadata: {
      manual: true,
      attendeeNames,
      note,
      respondedAt: now.toISOString(),
    },
  });

  await logGuestCommunication({
    eventId: input.eventId,
    guestId: guest.id,
    userId: admin.id,
    actorName: admin.name,
    channel: "manual",
    actionKey: "manual_rsvp_recorded",
    label: nextAttending ? "RSVP recorded manually (attending)" : "RSVP recorded manually (declined)",
    detail: details.join(" · "),
    success: true,
  });

  revalidatePath(`/admin/events/${input.eventId}`);
  return { ok: true as const };
}

export type GuestCommunicationPreviewPayload = {
  guestName: string;
  greeting: string;
  coupleNames: string | null;
  inviteIntroLine: string;
  randomizedLine: string;
  eventTitle: string;
  eventSubtitle: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
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
      phoneCountryCode: true,
      event: {
        select: {
          title: true,
          eventSubtitle: true,
          coupleNames: true,
          inviteMessageIntro: true,
          inviteMessageLineOverride: true,
        },
      },
    },
  });
  if (!guest) {
    return { ok: false as const, error: "Guest not found." };
  }

  const rsvpLink = buildGuestRsvpAbsoluteUrl(guest.token);
  const inviteParts = buildGuestInviteMessageParts({
    guestId: guestId,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    coupleNames: guest.event.coupleNames,
    rsvpLink,
    customIntroLine: guest.event.inviteMessageIntro,
    customLineOverride: guest.event.inviteMessageLineOverride,
  });
  const { inviteText, emailSubject, emailBody } = buildGuestInviteCommunicationParts({
    guestId: guestId,
    greeting: guest.greeting,
    guestName: guest.guestName,
    eventTitle: guest.event.title,
    coupleNames: guest.event.coupleNames,
    rsvpLink,
    customIntroLine: guest.event.inviteMessageIntro,
    customLineOverride: guest.event.inviteMessageLineOverride,
  });

  return {
    ok: true as const,
    preview: {
      guestName: guest.guestName,
      greeting: guest.greeting?.trim() || "Assalamu Alaikum",
      coupleNames: guest.event.coupleNames,
      inviteIntroLine: inviteParts.introLine,
      randomizedLine: inviteParts.randomizedLine,
      eventTitle: guest.event.title,
      eventSubtitle: guest.event.eventSubtitle,
      phone: guest.phone,
      phoneCountryCode: guest.phoneCountryCode,
      email: guest.email,
      hasEmail: Boolean(guest.email?.trim()),
      whatsappMessage: inviteText,
      rsvpLink,
      emailSubject,
      emailBody,
      whatsappDirectAvailable:
        normalizePhoneForWhatsAppGuestRecord({
          phone: guest.phone,
          phoneCountryCode: guest.phoneCountryCode,
        }) !== null,
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
