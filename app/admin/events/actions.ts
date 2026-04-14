"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";
import { getSafeImageSrc } from "@/lib/utils";
import { eventSchema, guestSchema } from "@/lib/validation";

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

export async function createEventAction(formData: FormData) {
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
  console.info("[event-image] value to write on create", { imagePath });
  const slug = await createUniqueSlug(parsed.data.title);

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
      theme: parsed.data.theme,
      description: parsed.data.description || null,
      slug,
      imagePath,
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

  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}`);
}

export async function updateEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) {
    throw new Error("Event id is missing.");
  }

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

  await prisma.event.update({
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
    },
  });

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
    const existing = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false, error: "This event no longer exists." };
    }

    await prisma.event.delete({
      where: { id: eventId },
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

  const parsed = guestSchema.safeParse({
    guestName: formData.get("guestName"),
    maxGuests: formData.get("maxGuests"),
    group: formData.get("group") || undefined,
    notes: formData.get("notes") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  await prisma.guest.create({
    data: {
      eventId,
      guestName: parsed.data.guestName,
      maxGuests: parsed.data.maxGuests,
      group: parsed.data.group ?? null,
      notes: parsed.data.notes ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email?.trim() || null,
      token: generateSecureToken(),
    },
  });

  revalidatePath(`/admin/events/${eventId}`);
}

export async function updateGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const guestId = String(formData.get("guestId") || "");
  if (!eventId || !guestId) {
    throw new Error("Missing event or guest id.");
  }

  const parsed = guestSchema.safeParse({
    guestName: formData.get("guestName"),
    maxGuests: formData.get("maxGuests"),
    group: formData.get("group") || undefined,
    notes: formData.get("notes") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const existing = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Guest not found for this event.");
  }

  await prisma.guest.update({
    where: { id: guestId },
    data: {
      guestName: parsed.data.guestName,
      maxGuests: parsed.data.maxGuests,
      group: parsed.data.group ?? null,
      notes: parsed.data.notes ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email?.trim() || null,
    },
  });

  revalidatePath(`/admin/events/${eventId}`);
}

export async function deleteGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const guestId = String(formData.get("guestId") || "");
  if (!eventId || !guestId) {
    throw new Error("Missing event or guest id.");
  }

  const existing = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Guest not found for this event.");
  }

  await prisma.guest.delete({ where: { id: guestId } });

  revalidatePath(`/admin/events/${eventId}`);
}
