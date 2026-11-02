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
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";
import { resolveSharedGuestState } from "@/lib/shared-guests";
import { getEventAccess } from "@/lib/wedding-access";
import type { Prisma } from "@prisma/client";
import { assertAllocationFits, getGuestListPermission, newGuestOwnership } from "@/lib/guest-allocation";
import { GuestListPermissionError, invitationPlaces, type GuestListPermission } from "@/lib/guest-permissions";

async function ensureCsvEventAccess(eventId: string) {
  const admin = await requireCurrentAdminUser();
  const access = await getEventAccess(admin, eventId);
  if (access.status === "not_found") {
    return { error: "Event not found.", event: null, admin: null };
  }
  if (access.status === "forbidden") {
    return { error: "You are not allowed to import guests for this event.", event: null, admin: null, perm: null };
  }
  const perm = await getGuestListPermission(admin, eventId);
  if (perm.level === "contributor" && !perm.allocation) {
    return {
      error: "You don't have a guest allowance for this event yet. Ask the organizer to set one.",
      event: null,
      admin: null,
      perm: null,
    };
  }
  return { error: null, event: access.event, admin, perm };
}

/** Charges the whole import to one allowance atomically: either every row fits, or nothing is created. */
async function createImportedGuests(
  perm: GuestListPermission,
  rows: Prisma.GuestUncheckedCreateInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownership = newGuestOwnership(perm);
  const data = rows.map((row) => ({ ...row, managedByUserId: ownership.managedByUserId, allocationId: ownership.allocationId }));
  try {
    await prisma.$transaction(async (tx) => {
      if (ownership.allocationId) {
        const places = data.reduce((sum, row) => sum + invitationPlaces({
          maxGuests: row.maxGuests,
          menCount: row.menCount ?? 0,
          womenCount: row.womenCount ?? 0,
          kidsCount: row.kidsCount ?? 0,
        }), 0);
        await assertAllocationFits(tx, ownership.allocationId, places);
      }
      for (const row of data) {
        await tx.guest.create({ data: row });
      }
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof GuestListPermissionError) return { ok: false, error: error.message };
    throw error;
  }
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

  const sharedScope = { eventId, weddingId: access.event.weddingId };
  const createData = await Promise.all(
    toCreate.map(async (row) => {
      const sharedState = await resolveSharedGuestState(
        prisma,
        {
          eventId,
          guestName: row.guestName,
          phone: row.phone?.trim() || null,
          phoneCountryCode: row.phoneCountryCode?.trim() || null,
          email: row.email?.trim() || null,
        },
        sharedScope,
      );
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

  const created = await createImportedGuests(access.perm!, createData);
  if (!created.ok) {
    return { error: created.error, created: 0, skippedInvalid, skippedDuplicateInDb, skippedDuplicateInFile };
  }
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

  const sharedScope = { eventId, weddingId: access.event.weddingId };
  const createData = await Promise.all(
    toCreate.map(async (row) => {
      const sharedState = await resolveSharedGuestState(
        prisma,
        {
          eventId,
          guestName: row.guestName,
          phone: row.phone?.trim() || null,
          phoneCountryCode: row.phoneCountryCode?.trim() || null,
          email: row.email?.trim() || null,
        },
        sharedScope,
      );
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
  const created = await createImportedGuests(access.perm!, createData);
  if (!created.ok) {
    return { error: created.error, created: 0, skippedInvalid, skippedDuplicateInDb, skippedDuplicateInFile };
  }
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
