import Papa from "papaparse";
import { z } from "zod";

function parseFamilyInviteCell(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
}

export const guestImportRowSchema = z
  .object({
    guestName: z.string().trim().min(1, "guestName is required"),
    greeting: z.string().trim().max(80, "greeting must be 80 characters or less").optional(),
    menCount: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : v), z.coerce.number().int().min(0, "men must be 0 or greater")),
    womenCount: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : v), z.coerce.number().int().min(0, "women must be 0 or greater")),
    kidsCount: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : v), z.coerce.number().int().min(0, "kids must be 0 or greater")),
    group: z.string().trim().optional(),
    tableName: z.string().trim().max(120).optional(),
    notes: z.string().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
    isFamilyInvite: z.preprocess((v) => {
      if (v === undefined || v === null || v === "") return false;
      return parseFamilyInviteCell(v);
    }, z.boolean()),
  })
  .superRefine((data, ctx) => {
    const total = data.menCount + data.womenCount + data.kidsCount;
    if (total < 1) {
      ctx.addIssue({ code: "custom", message: "total guests must be at least 1", path: ["menCount"] });
    }
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
    name: "guestName",
    men: "menCount",
    mencount: "menCount",
    women: "womenCount",
    womencount: "womenCount",
    kids: "kidsCount",
    kidscount: "kidsCount",
    children: "kidsCount",
    group: "group",
    tablename: "tableName",
    "table name": "tableName",
    table: "tableName",
    tablenumber: "tableName",
    "table number": "tableName",
    "table assignment": "tableName",
    greeting: "greeting",
    notes: "notes",
    phone: "phone",
    email: "email",
    isfamilyinvite: "isFamilyInvite",
    "family invite": "isFamilyInvite",
    familyinvite: "isFamilyInvite",
    "is family invite": "isFamilyInvite",
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

function positionalRowToFields(row: unknown[]): Record<string, string> {
  return {
    guestName: String(row[0] ?? "").trim(),
    menCount: String(row[1] ?? "").trim(),
    womenCount: String(row[2] ?? "").trim(),
    kidsCount: String(row[3] ?? "").trim(),
    greeting: String(row[4] ?? "").trim(),
    group: String(row[5] ?? "").trim(),
    tableName: String(row[6] ?? "").trim(),
    notes: String(row[7] ?? "").trim(),
    phone: String(row[8] ?? "").trim(),
    email: String(row[9] ?? "").trim(),
    isFamilyInvite: String(row[10] ?? "").trim(),
  };
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
  headerMode: "header" | "no_header";
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
  const parsedWithHeaders = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  for (const err of parsedWithHeaders.errors) {
    if (err.type === "Quotes" || err.type === "FieldMismatch") {
      continue;
    }
    parseErrors.push(err.message || "CSV parse error");
  }

  const fields = parsedWithHeaders.meta.fields?.filter((f): f is string => Boolean(f?.trim())) ?? [];
  const mapped = new Set<string>();
  for (const f of fields) {
    const m = mapHeaderToField(f);
    if (m) {
      mapped.add(m);
    }
  }
  const hasRecognizedHeaders =
    mapped.has("guestName") || mapped.has("menCount") || mapped.has("womenCount") || mapped.has("kidsCount");
  const headerMode: "header" | "no_header" = hasRecognizedHeaders ? "header" : "no_header";

  const requiredHeadersMissing: string[] = [];
  if (headerMode === "header") {
    if (!mapped.has("guestName")) requiredHeadersMissing.push("guestName");
    if (!mapped.has("menCount")) requiredHeadersMissing.push("men");
    if (!mapped.has("womenCount")) requiredHeadersMissing.push("women");
    if (!mapped.has("kidsCount")) requiredHeadersMissing.push("kids");
  }

  const rows: CsvPreviewRow[] = [];
  const seenInFile = new Set<string>();
  const parsedRows =
    headerMode === "header"
      ? parsedWithHeaders.data.map((raw, index) => ({
          lineNumber: index + 2,
          fields: raw ? rowToFields(raw) : {},
        }))
      : Papa.parse<unknown[]>(csvText, {
          header: false,
          skipEmptyLines: "greedy",
        }).data.map((raw, index) => ({
          lineNumber: index + 1,
          fields: positionalRowToFields(Array.isArray(raw) ? raw : []),
        }));

  parsedRows.forEach((row) => {
    const lineNumber = row.lineNumber;
    const obj = row.fields;
    if (!obj || Object.keys(obj).length === 0 || !String(obj.guestName ?? "").trim()) {
      return;
    }
    const safeParse = guestImportRowSchema.safeParse({
      guestName: obj.guestName ?? "",
      menCount: obj.menCount,
      womenCount: obj.womenCount,
      kidsCount: obj.kidsCount,
      group: obj.group || undefined,
      tableName: obj.tableName || undefined,
      greeting: obj.greeting || undefined,
      notes: obj.notes || undefined,
      phone: obj.phone || undefined,
      email: obj.email || undefined,
      isFamilyInvite: obj.isFamilyInvite === "" ? undefined : obj.isFamilyInvite,
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
  const ready = requiredHeadersMissing.length === 0 && parseErrors.length === 0 && rows.length > 0 && !hasInvalidRows;

  return {
    ready,
    importableCount,
    parseErrors,
    rows,
    requiredHeadersMissing,
    rowCount: rows.length,
    headerMode,
  };
}
