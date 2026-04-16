"use server";

import { revalidatePath } from "next/cache";
import {
  normalizeGuestNameKey,
  previewGuestCsv,
  selectRowsForImport,
} from "@/lib/csv-guests";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";

async function ensureCsvEventAccess(eventId: string) {
  const admin = await requireCurrentAdminUser();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerUserId: true },
  });
  if (!event) {
    return { error: "Event not found.", event: null, admin: null };
  }
  if (!isSuperAdmin(admin) && event.ownerUserId !== admin.id) {
    return { error: "You are not allowed to import guests for this event.", event: null, admin: null };
  }
  return { error: null, event, admin };
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
          greeting: row.greeting?.trim() || "Assalamu Alaikum",
          menCount: row.menCount,
          womenCount: row.womenCount,
          kidsCount: row.kidsCount,
          maxGuests: row.menCount + row.womenCount + row.kidsCount,
          group: row.group?.trim() || null,
          tableName: row.tableName?.trim() || null,
          notes: row.notes?.trim() || null,
          phone: row.phone?.trim() || null,
          email: row.email?.trim() || null,
          isFamilyInvite: row.isFamilyInvite,
          token: generateSecureToken(),
        },
      }),
    ),
  );

  if (access.admin) {
    await logAuditActivity({
      eventId,
      userId: access.admin.id,
      userName: access.admin.name,
      actionType: "guest_bulk_imported",
      entityType: "Guest",
      entityId: eventId,
      entityName: "CSV import",
      message: `${access.admin.name} imported ${toCreate.length} guest(s) from CSV.`,
      metadata: {
        created: toCreate.length,
        skippedInvalid,
        skippedDuplicateInDb,
        skippedDuplicateInFile,
      },
    });
  }

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
