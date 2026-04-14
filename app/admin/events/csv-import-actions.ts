"use server";

import { revalidatePath } from "next/cache";
import {
  normalizeGuestNameKey,
  previewGuestCsv,
  selectRowsForImport,
} from "@/lib/csv-guests";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";

async function ensureCsvEventAccess(eventId: string) {
  const admin = await requireCurrentAdminUser();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerUserId: true },
  });
  if (!event) {
    return { error: "Event not found.", event: null };
  }
  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    return { error: "You are not allowed to import guests for this event.", event: null };
  }
  return { error: null, event };
}

export async function previewGuestCsvAction(eventId: string, csvText: string) {
  const access = await ensureCsvEventAccess(eventId);
  if (!access.event) {
    return { error: access.error, preview: null };
  }

  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { guestName: true },
  });
  const existing = new Set(guests.map((g) => normalizeGuestNameKey(g.guestName)));

  const preview = previewGuestCsv(csvText, existing);

  return {
    error: null,
    preview,
  };
}

export async function commitGuestCsvImportAction(eventId: string, csvText: string) {
  const access = await ensureCsvEventAccess(eventId);
  if (!access.event) {
    return { error: access.error };
  }

  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { guestName: true },
  });
  const existing = new Set(guests.map((g) => normalizeGuestNameKey(g.guestName)));

  const result = previewGuestCsv(csvText, existing);
  const toCreate = selectRowsForImport(result.rows);

  let skippedInvalid = 0;
  let skippedDuplicateInDb = 0;
  let skippedDuplicateInFile = 0;

  for (const row of result.rows) {
    if (!row.data) {
      skippedInvalid += 1;
      continue;
    }
    if (row.duplicateInDatabase) {
      skippedDuplicateInDb += 1;
      continue;
    }
    if (row.duplicateInFile) {
      skippedDuplicateInFile += 1;
    }
  }

  if (toCreate.length === 0) {
    revalidatePath(`/admin/events/${eventId}`);
    return {
      error: null,
      created: 0,
      skippedInvalid,
      skippedDuplicateInDb,
      skippedDuplicateInFile,
      message: "No new guests to import. Fix CSV errors or remove duplicate names.",
    };
  }

  await prisma.$transaction(
    toCreate.map((row) =>
      prisma.guest.create({
        data: {
          eventId,
          guestName: row.guestName,
          maxGuests: row.maxGuests,
          group: row.group?.trim() || null,
          notes: row.notes?.trim() || null,
          phone: row.phone?.trim() || null,
          email: row.email?.trim() || null,
          token: generateSecureToken(),
        },
      }),
    ),
  );

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");

  return {
    error: null,
    created: toCreate.length,
    skippedInvalid,
    skippedDuplicateInDb,
    skippedDuplicateInFile,
  };
}
