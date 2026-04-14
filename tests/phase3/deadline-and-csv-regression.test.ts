import { describe, expect, it } from "vitest";
import { getRsvpDeadlineMeta } from "@/lib/utils";
import { previewGuestCsv, selectRowsForImport } from "@/lib/csv-guests";

function dateWithOffset(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

describe("Phase 3 - deadline statuses", () => {
  const now = new Date(2026, 3, 14);

  it("returns open for deadline beyond 7 days", () => {
    expect(getRsvpDeadlineMeta(dateWithOffset(now, 10), now)?.status).toBe("open");
  });

  it("returns closing_soon for deadlines within 7 days", () => {
    expect(getRsvpDeadlineMeta(dateWithOffset(now, 5), now)?.status).toBe("closing_soon");
  });

  it("returns closes_today for same-day deadline", () => {
    expect(getRsvpDeadlineMeta(dateWithOffset(now, 0), now)?.status).toBe("closes_today");
  });

  it("returns closed for past deadline", () => {
    expect(getRsvpDeadlineMeta(dateWithOffset(now, -1), now)?.status).toBe("closed");
  });
});

describe("Phase 3 - CSV import regressions", () => {
  it("flags missing required headers", () => {
    const result = previewGuestCsv("name,max\nJohn,2", new Set());
    expect(result.requiredHeadersMissing).toContain("guestName");
    expect(result.requiredHeadersMissing).toContain("maxGuests");
  });

  it("skips duplicates in file and database during import selection", () => {
    const csv = [
      "guestName,maxGuests",
      "Valli Family,2",
      "Valli Family,4",
      "Shah Family,3",
    ].join("\n");
    const preview = previewGuestCsv(csv, new Set(["shah family"]));
    const rows = selectRowsForImport(preview.rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.guestName).toBe("Valli Family");
    expect(rows[0]?.maxGuests).toBe(2);
  });
});
