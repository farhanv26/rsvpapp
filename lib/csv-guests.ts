import Papa from "papaparse";
import { z } from "zod";

export const guestImportRowSchema = z
  .object({
    guestName: z.string().trim().min(1, "guestName is required"),
    greeting: z.string().trim().max(80, "greeting must be 80 characters or less").optional(),
    maxGuests: z.coerce.number().int().min(1, "maxGuests must be at least 1"),
    group: z.string().trim().optional(),
    notes: z.string().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.email && data.email.length > 0) {
      const ok = z.string().email().safeParse(data.email);
      if (!ok.success) {
        ctx.addIssue({ code: "custom", message: "Invalid email address", path: ["email"] });
      }
    }
  });

export type GuestImportRow = z.infer<typeof guestImportRowSchema>;

export function normalizeGuestNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapHeaderToField(header: string): string | null {
  const k = header.trim().toLowerCase().replace(/\s+/g, " ");
  const map: Record<string, string> = {
    guestname: "guestName",
    "guest name": "guestName",
    maxguests: "maxGuests",
    "max guests": "maxGuests",
    group: "group",
    greeting: "greeting",
    notes: "notes",
    phone: "phone",
    email: "email",
  };
  return map[k] ?? null;
}

function rowToFields(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = mapHeaderToField(key);
    if (!field) {
      continue;
    }
    out[field] = value === null || value === undefined ? "" : String(value).trim();
  }
  return out;
}

export type CsvPreviewRow = {
  lineNumber: number;
  data: GuestImportRow | null;
  errors: string[];
  duplicateInFile: boolean;
  duplicateInDatabase: boolean;
};

export type CsvPreviewResult = {
  /** True when every row is valid and headers are present (strict). */
  ready: boolean;
  /** Number of guests that would be created (excludes dupes and invalid). */
  importableCount: number;
  parseErrors: string[];
  rows: CsvPreviewRow[];
  requiredHeadersMissing: string[];
  rowCount: number;
};

/** Rows that will actually be inserted: skip DB dupes and later file dupes. */
export function selectRowsForImport(previewRows: CsvPreviewRow[]): GuestImportRow[] {
  const seen = new Set<string>();
  const out: GuestImportRow[] = [];

  for (const pr of previewRows) {
    if (!pr.data || pr.errors.length) {
      continue;
    }
    const norm = normalizeGuestNameKey(pr.data.guestName);
    if (pr.duplicateInDatabase) {
      continue;
    }
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    out.push(pr.data);
  }

  return out;
}

export function previewGuestCsv(
  csvText: string,
  existingNormalizedNames: Set<string>,
): CsvPreviewResult {
  const parseErrors: string[] = [];
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  for (const err of parsed.errors) {
    if (err.type === "Quotes" || err.type === "FieldMismatch") {
      continue;
    }
    parseErrors.push(err.message || "CSV parse error");
  }

  const fields = parsed.meta.fields?.filter((f): f is string => Boolean(f?.trim())) ?? [];
  const mapped = new Set<string>();
  for (const f of fields) {
    const m = mapHeaderToField(f);
    if (m) {
      mapped.add(m);
    }
  }

  const requiredHeadersMissing: string[] = [];
  if (!mapped.has("guestName")) {
    requiredHeadersMissing.push("guestName");
  }
  if (!mapped.has("maxGuests")) {
    requiredHeadersMissing.push("maxGuests");
  }

  const rows: CsvPreviewRow[] = [];
  const seenInFile = new Set<string>();

  parsed.data.forEach((raw, index) => {
    const lineNumber = index + 2;
    if (!raw || Object.keys(raw).length === 0) {
      return;
    }
    const obj = rowToFields(raw);
    const safeParse = guestImportRowSchema.safeParse({
      guestName: obj.guestName ?? "",
      maxGuests: obj.maxGuests === "" ? undefined : obj.maxGuests,
      group: obj.group || undefined,
      greeting: obj.greeting || undefined,
      notes: obj.notes || undefined,
      phone: obj.phone || undefined,
      email: obj.email || undefined,
    });

    if (!safeParse.success) {
      rows.push({
        lineNumber,
        data: null,
        errors: safeParse.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        duplicateInFile: false,
        duplicateInDatabase: false,
      });
      return;
    }

    const data = safeParse.data;
    const norm = normalizeGuestNameKey(data.guestName);
    const duplicateInFile = seenInFile.has(norm);
    if (!duplicateInFile) {
      seenInFile.add(norm);
    }
    const duplicateInDatabase = existingNormalizedNames.has(norm);

    rows.push({
      lineNumber,
      data,
      errors: [],
      duplicateInFile,
      duplicateInDatabase,
    });
  });

  const hasInvalidRows = rows.some((r) => r.data === null);
  const importableCount = selectRowsForImport(rows).length;
  const ready =
    requiredHeadersMissing.length === 0 &&
    parseErrors.length === 0 &&
    rows.length > 0 &&
    !hasInvalidRows;

  return {
    ready,
    importableCount,
    parseErrors,
    rows,
    requiredHeadersMissing,
    rowCount: rows.length,
  };
}
