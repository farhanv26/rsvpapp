"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";
import { eventSchema, guestSchema } from "@/lib/validation";

async function saveEventImage(image: File) {
  if (!image || image.size === 0) {
    return null;
  }

  if (!["image/png", "image/jpeg"].includes(image.type)) {
    throw new Error("Image must be PNG or JPG/JPEG.");
  }

  const ext = image.type === "image/png" ? "png" : "jpg";
  const filename = `${Date.now()}-${generateSecureToken().slice(0, 12)}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  const bytes = await image.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));
  return `/uploads/${filename}`;
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

  const image = formData.get("image");
  const imagePath = image instanceof File ? await saveEventImage(image) : null;
  const slug = await createUniqueSlug(parsed.data.title);

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
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

  const image = formData.get("image");
  const imagePath = image instanceof File ? await saveEventImage(image) : null;
  const slug = await createUniqueSlug(parsed.data.title, eventId);

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: parsed.data.title,
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
