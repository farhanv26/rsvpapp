"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  guestImportRowSchema,
  normalizeGuestNameKey,
  previewGuestCsv,
  selectRowsForImport,
  type CsvPreviewRow,
} from "@/lib/csv-guests";
import { parseCsvPhoneRow } from "@/lib/phone";
import { isSuperAdmin, requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";
import { resolveSharedGuestState } from "@/lib/shared-guests";

async function ensureCsvEventAccess(eventId: string) {
  const admin = await requireCurrentAdminUser();
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
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
    where: { eventId, deletedAt: null },
    select: { guestName: true },
  });
  const existing = new Set(guests.map((g) => normalizeGuestNameKey(g.guestName)));

  const preview = previewGuestCsv(csvText, existing);

  return {
    error: null,
    preview,
  };
}

const guestImportRowsSchema = z.array(guestImportRowSchema);

/** Import from client-prepared rows (after inline edits). Validates and applies duplicate rules server-side. */
export async function importGuestCsvRowsAction(eventId: string, rows: unknown) {
  const access = await ensureCsvEventAccess(eventId);
  if (!access.event) {
    return { error: access.error };
  }

  const parsed = guestImportRowsSchema.safeParse(rows);
  if (!parsed.success) {
    return {
      error: "Invalid import data. Fix validation errors and try again.",
      created: 0,
      skippedInvalid: 0,
      skippedDuplicateInDb: 0,
      skippedDuplicateInFile: 0,
    };
  }

  const guests = await prisma.guest.findMany({
    where: { eventId, deletedAt: null },
    select: { guestName: true },
  });
  const existingNames = new Set(guests.map((g) => normalizeGuestNameKey(g.guestName)));

  const merged = parsed.data.map((data) => {
    const pi = parseCsvPhoneRow(data.phone, data.phoneCountryCode);
    return {
      ...data,
      phone: pi.phone ?? undefined,
      phoneCountryCode: pi.phoneCountryCode ?? undefined,
    };
  });

  const previewRows: CsvPreviewRow[] = merged.map((data, i) => {
    const pi = parseCsvPhoneRow(data.phone, data.phoneCountryCode);
    const v = guestImportRowSchema.safeParse(data);
    if (!v.success) {
      return {
        lineNumber: i + 1,
        data: null,
        errors: v.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        duplicateInFile: false,
        duplicateInDatabase: false,
        phoneImport: pi,
      };
    }
    return {
      lineNumber: i + 1,
      data: v.data,
      errors: [],
      duplicateInFile: false,
      duplicateInDatabase: existingNames.has(normalizeGuestNameKey(v.data.guestName)),
      phoneImport: pi,
    };
  });

  const seen = new Set<string>();
  for (const row of previewRows) {
    if (!row.data) continue;
    const norm = normalizeGuestNameKey(row.data.guestName);
    row.duplicateInFile = seen.has(norm);
    if (!seen.has(norm)) seen.add(norm);
  }

  const toCreate = selectRowsForImport(previewRows);

  let skippedInvalid = 0;
  let skippedDuplicateInDb = 0;
  let skippedDuplicateInFile = 0;
  for (const row of previewRows) {
    if (!row.data) skippedInvalid += 1;
    else if (row.duplicateInDatabase) skippedDuplicateInDb += 1;
    else if (row.duplicateInFile) skippedDuplicateInFile += 1;
  }

  if (toCreate.length === 0) {
    revalidatePath(`/admin/events/${eventId}`);
    return {
      error: null,
      created: 0,
      skippedInvalid,
      skippedDuplicateInDb,
      skippedDuplicateInFile,
      message: "No new guests to import. Fix errors, duplicates, or validation issues.",
    };
  }

  const createData = await Promise.all(
    toCreate.map(async (row) => {
      const sharedState = await resolveSharedGuestState(prisma, {
        eventId,
        guestName: row.guestName,
        phone: row.phone?.trim() || null,
        phoneCountryCode: row.phoneCountryCode?.trim() || null,
        email: row.email?.trim() || null,
      });
      const guestTotal = row.menCount + row.womenCount + row.kidsCount;
      const forceExclude = sharedState.shouldExcludeFromTotals;
      const excludedMenCount = forceExclude ? row.menCount : 0;
      const excludedWomenCount = forceExclude ? row.womenCount : 0;
      const excludedKidsCount = forceExclude ? row.kidsCount : 0;
      const excludedGuestCount = excludedMenCount + excludedWomenCount + excludedKidsCount;
      const excludeFromTotals = excludedGuestCount >= guestTotal && guestTotal > 0;
      const excludeReason =
        excludedGuestCount > 0
          ? (sharedState.defaultExcludeReason || row.excludeReason?.trim() || "Manual exclusion")
          : null;
      return {
        eventId,
        guestName: row.guestName,
        greeting: row.greeting?.trim() || "Assalamu Alaikum",
        menCount: row.menCount,
        womenCount: row.womenCount,
        kidsCount: row.kidsCount,
        maxGuests: guestTotal,
        group: row.group?.trim() || null,
        tableName: row.tableName?.trim() || null,
        notes: row.notes?.trim() || null,
        phone: row.phone?.trim() || null,
        phoneCountryCode: row.phoneCountryCode?.trim() || null,
        email: row.email?.trim() || null,
        isFamilyInvite: row.isFamilyInvite,
        token: generateSecureToken(),
        sharedGuestKey: sharedState.sharedGuestKey,
        countOwnerEventId: sharedState.countOwnerEventId,
        excludeFromTotals,
        excludedGuestCount,
        excludedMenCount,
        excludedWomenCount,
        excludedKidsCount,
        excludeReason,
      };
    }),
  );

  await prisma.$transaction(createData.map((data) => prisma.guest.create({ data })));
  const sharedDetectedCount = createData.filter((d) => Boolean(d.sharedGuestKey && d.countOwnerEventId)).length;

  if (access.admin) {
    await logAuditActivity({
      eventId,
      userId: access.admin.id,
      userName: access.admin.name,
      actionType: "guest_bulk_imported",
      entityType: "Guest",
      entityId: eventId,
      entityName: "CSV import",
      message: `${access.admin.name} imported ${toCreate.length} guest(s) from CSV (inline editor).`,
      metadata: {
        created: toCreate.length,
        skippedInvalid,
        skippedDuplicateInDb,
        skippedDuplicateInFile,
        sharedDetectedCount,
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
    sharedDetectedCount,
  };
}

export async function commitGuestCsvImportAction(eventId: string, csvText: string) {
  const access = await ensureCsvEventAccess(eventId);
  if (!access.event) {
    return { error: access.error };
  }

  const guests = await prisma.guest.findMany({
    where: { eventId, deletedAt: null },
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

  const createData = await Promise.all(
    toCreate.map(async (row) => {
      const sharedState = await resolveSharedGuestState(prisma, {
        eventId,
        guestName: row.guestName,
        phone: row.phone?.trim() || null,
        phoneCountryCode: row.phoneCountryCode?.trim() || null,
        email: row.email?.trim() || null,
      });
      const guestTotal = row.menCount + row.womenCount + row.kidsCount;
      const forceExclude = sharedState.shouldExcludeFromTotals;
      const excludedMenCount = forceExclude ? row.menCount : 0;
      const excludedWomenCount = forceExclude ? row.womenCount : 0;
      const excludedKidsCount = forceExclude ? row.kidsCount : 0;
      const excludedGuestCount = excludedMenCount + excludedWomenCount + excludedKidsCount;
      const excludeFromTotals = excludedGuestCount >= guestTotal && guestTotal > 0;
      const excludeReason =
        excludedGuestCount > 0
          ? (sharedState.defaultExcludeReason || row.excludeReason?.trim() || "Manual exclusion")
          : null;
      return {
        eventId,
        guestName: row.guestName,
        greeting: row.greeting?.trim() || "Assalamu Alaikum",
        menCount: row.menCount,
        womenCount: row.womenCount,
        kidsCount: row.kidsCount,
        maxGuests: guestTotal,
        group: row.group?.trim() || null,
        tableName: row.tableName?.trim() || null,
        notes: row.notes?.trim() || null,
        phone: row.phone?.trim() || null,
        phoneCountryCode: row.phoneCountryCode?.trim() || null,
        email: row.email?.trim() || null,
        isFamilyInvite: row.isFamilyInvite,
        token: generateSecureToken(),
        sharedGuestKey: sharedState.sharedGuestKey,
        countOwnerEventId: sharedState.countOwnerEventId,
        excludeFromTotals,
        excludedGuestCount,
        excludedMenCount,
        excludedWomenCount,
        excludedKidsCount,
        excludeReason,
      };
    }),
  );
  await prisma.$transaction(createData.map((data) => prisma.guest.create({ data })));
  const sharedDetectedCount = createData.filter((d) => Boolean(d.sharedGuestKey && d.countOwnerEventId)).length;

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
        sharedDetectedCount,
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
    sharedDetectedCount,
  };
}
