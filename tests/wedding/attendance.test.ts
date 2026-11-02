import { describe, expect, it } from "vitest";
import {
  classifyExclusion,
  countedBreakdown,
  effectiveExclusionFields,
  summarizeEventAttendance,
  type AttendanceStatusGuest,
} from "@/lib/attendance";

function g(partial: Partial<AttendanceStatusGuest> = {}): AttendanceStatusGuest {
  return {
    menCount: 2,
    womenCount: 2,
    kidsCount: 1,
    maxGuests: 5,
    excludeFromTotals: false,
    excludeReason: null,
    excludedGuestCount: 0,
    excludedMenCount: 0,
    excludedWomenCount: 0,
    excludedKidsCount: 0,
    attending: null,
    attendingCount: null,
    respondedAt: null,
    invitedAt: null,
    ...partial,
  };
}

const fullAuto = {
  excludeFromTotals: true,
  excludeReason: "Duplicate guest in another event",
  excludedGuestCount: 5,
  excludedMenCount: 2,
  excludedWomenCount: 2,
  excludedKidsCount: 1,
};

describe("classifyExclusion", () => {
  it("separates none, manual, legacy automatic and ambiguous records", () => {
    expect(classifyExclusion(g())).toBe("none");
    expect(classifyExclusion(g({ ...fullAuto }))).toBe("legacy_automatic");
    expect(classifyExclusion(g({ ...fullAuto, excludeReason: "Counted elsewhere" }))).toBe("legacy_automatic");
    expect(classifyExclusion(g({ ...fullAuto, excludeReason: "Manual exclusion" }))).toBe("manual");
    expect(classifyExclusion(g({ excludedMenCount: 1, excludedGuestCount: 1, excludeReason: "Groom's side counts him" }))).toBe("manual");
    expect(classifyExclusion(g({ ...fullAuto, excludedKidsCount: 0, excludedGuestCount: 4 }))).toBe("ambiguous");
    expect(classifyExclusion(g({ ...fullAuto, excludeReason: null }))).toBe("ambiguous");
  });
});

describe("countedBreakdown", () => {
  it("counts the whole household when the only exclusion is a legacy automatic one", () => {
    expect(countedBreakdown(g({ ...fullAuto }))).toEqual({ men: 2, women: 2, kids: 1, total: 5 });
    expect(effectiveExclusionFields(g({ ...fullAuto }))).toMatchObject({ exclusionKind: "legacy_automatic", excludedGuestCount: 0 });
  });

  it("preserves manual and ambiguous exclusions", () => {
    expect(countedBreakdown(g({ excludedMenCount: 1, excludedGuestCount: 1, excludeReason: "Manual exclusion" }))).toEqual({
      men: 1,
      women: 2,
      kids: 1,
      total: 4,
    });
    expect(countedBreakdown(g({ ...fullAuto, excludeReason: null })).total).toBe(0);
  });

  it("uses maxGuests when category counts are missing", () => {
    expect(countedBreakdown(g({ menCount: 0, womenCount: 0, kidsCount: 0, maxGuests: 3 })).total).toBe(3);
  });
});

describe("summarizeEventAttendance", () => {
  it("summarizes households, people and review counts for one event", () => {
    const s = summarizeEventAttendance([
      g({ invitedAt: new Date(), respondedAt: new Date(), attending: true, attendingCount: 4 }),
      g({ ...fullAuto, invitedAt: new Date() }),
      g({ ...fullAuto, excludeReason: "Manual exclusion" }),
      g({ ...fullAuto, excludeReason: null }),
    ]);
    expect(s).toMatchObject({
      households: 4,
      countedHouseholds: 2,
      invitedPeople: 10,
      confirmedPeople: 4,
      attendingHouseholds: 1,
      awaitingReplyHouseholds: 1,
      manualExclusions: 1,
      legacyAutomaticIgnored: 1,
      needsReview: 1,
      excludedPeople: 10,
    });
  });
});
