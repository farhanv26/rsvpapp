/**
 * Per-event attendance rules (single source of truth for every stats surface).
 *
 * A household counts toward every event it is invited to. Exclusions are honoured only when a
 * person decided them:
 * - "manual":           excluded with a reason someone entered (or the default "Manual exclusion").
 * - "legacy_automatic": excluded by the old cross-event duplicate logic for the whole household.
 *                       Ignored for counting; the stored values are left untouched.
 * - "ambiguous":        an automatic reason with partial counts, or an exclusion with no reason.
 *                       Kept excluded and flagged for review rather than guessed.
 */
export const LEGACY_AUTOMATIC_EXCLUDE_REASONS = ["Duplicate guest in another event", "Counted elsewhere"] as const;

export type ExclusionKind = "none" | "manual" | "legacy_automatic" | "ambiguous";

export type AttendanceGuest = {
  menCount: number | null;
  womenCount: number | null;
  kidsCount: number | null;
  maxGuests: number;
  excludeFromTotals: boolean;
  excludeReason: string | null;
  excludedGuestCount: number | null;
  excludedMenCount: number | null;
  excludedWomenCount: number | null;
  excludedKidsCount: number | null;
};

export type GuestBreakdown = { men: number; women: number; kids: number; total: number };

function n(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function invitedBreakdown(g: AttendanceGuest): GuestBreakdown {
  const men = n(g.menCount);
  const women = n(g.womenCount);
  const kids = n(g.kidsCount);
  const sum = men + women + kids;
  return { men, women, kids, total: sum > 0 ? sum : n(g.maxGuests) };
}

export function classifyExclusion(g: AttendanceGuest): ExclusionKind {
  const catSum = n(g.excludedMenCount) + n(g.excludedWomenCount) + n(g.excludedKidsCount);
  const legacyCount = n(g.excludedGuestCount);
  if (!g.excludeFromTotals && catSum === 0 && legacyCount === 0) return "none";

  const reason = g.excludeReason?.trim() || "";
  if (!reason) return "ambiguous";
  if (!(LEGACY_AUTOMATIC_EXCLUDE_REASONS as readonly string[]).includes(reason)) return "manual";

  const invited = invitedBreakdown(g);
  const wholeHousehold =
    catSum > 0
      ? n(g.excludedMenCount) === invited.men &&
        n(g.excludedWomenCount) === invited.women &&
        n(g.excludedKidsCount) === invited.kids
      : legacyCount >= invited.total;
  return wholeHousehold && g.excludeFromTotals ? "legacy_automatic" : "ambiguous";
}

/** People from this household who count toward this event's totals. */
export function countedBreakdown(g: AttendanceGuest): GuestBreakdown {
  const invited = invitedBreakdown(g);
  const kind = classifyExclusion(g);
  if (kind === "none" || kind === "legacy_automatic") return invited;

  const excMen = n(g.excludedMenCount);
  const excWomen = n(g.excludedWomenCount);
  const excKids = n(g.excludedKidsCount);
  if (excMen + excWomen + excKids > 0) {
    const men = Math.max(invited.men - excMen, 0);
    const women = Math.max(invited.women - excWomen, 0);
    const kids = Math.max(invited.kids - excKids, 0);
    return { men, women, kids, total: men + women + kids };
  }
  const legacy = n(g.excludedGuestCount);
  if (legacy === 0) return invited;
  return { men: 0, women: 0, kids: 0, total: Math.max(invited.total - legacy, 0) };
}

/** Exclusion values the UI should treat as effective (legacy automatic exclusions become zero). */
export function effectiveExclusionFields(g: AttendanceGuest) {
  const kind = classifyExclusion(g);
  if (kind === "legacy_automatic") {
    return {
      exclusionKind: kind,
      excludeFromTotals: false,
      excludedGuestCount: 0,
      excludedMenCount: 0,
      excludedWomenCount: 0,
      excludedKidsCount: 0,
    };
  }
  return {
    exclusionKind: kind,
    excludeFromTotals: g.excludeFromTotals,
    excludedGuestCount: n(g.excludedGuestCount),
    excludedMenCount: n(g.excludedMenCount),
    excludedWomenCount: n(g.excludedWomenCount),
    excludedKidsCount: n(g.excludedKidsCount),
  };
}

export type AttendanceStatusGuest = AttendanceGuest & {
  attending: boolean | null;
  attendingCount: number | null;
  respondedAt: Date | string | null;
  invitedAt: Date | string | null;
};

export type EventAttendanceSummary = {
  households: number;
  countedHouseholds: number;
  invitedPeople: number;
  men: number;
  women: number;
  kids: number;
  invitedHouseholds: number;
  notInvitedHouseholds: number;
  respondedHouseholds: number;
  pendingHouseholds: number;
  awaitingReplyHouseholds: number;
  attendingHouseholds: number;
  declinedHouseholds: number;
  confirmedPeople: number;
  responseRate: number;
  attendanceRate: number;
  manualExclusions: number;
  excludedPeople: number;
  legacyAutomaticIgnored: number;
  needsReview: number;
};

export function summarizeEventAttendance(guests: AttendanceStatusGuest[]): EventAttendanceSummary {
  const s: EventAttendanceSummary = {
    households: guests.length,
    countedHouseholds: 0,
    invitedPeople: 0,
    men: 0,
    women: 0,
    kids: 0,
    invitedHouseholds: 0,
    notInvitedHouseholds: 0,
    respondedHouseholds: 0,
    pendingHouseholds: 0,
    awaitingReplyHouseholds: 0,
    attendingHouseholds: 0,
    declinedHouseholds: 0,
    confirmedPeople: 0,
    responseRate: 0,
    attendanceRate: 0,
    manualExclusions: 0,
    excludedPeople: 0,
    legacyAutomaticIgnored: 0,
    needsReview: 0,
  };
  for (const g of guests) {
    const kind = classifyExclusion(g);
    if (kind === "manual") s.manualExclusions += 1;
    if (kind === "legacy_automatic") s.legacyAutomaticIgnored += 1;
    if (kind === "ambiguous") s.needsReview += 1;

    const counted = countedBreakdown(g);
    s.excludedPeople += invitedBreakdown(g).total - counted.total;
    if (counted.total <= 0) continue;
    s.countedHouseholds += 1;
    s.invitedPeople += counted.total;
    s.men += counted.men;
    s.women += counted.women;
    s.kids += counted.kids;
    if (g.invitedAt) s.invitedHouseholds += 1;
    else s.notInvitedHouseholds += 1;
    if (g.respondedAt) s.respondedHouseholds += 1;
    else s.pendingHouseholds += 1;
    if (g.invitedAt && !g.respondedAt) s.awaitingReplyHouseholds += 1;
    if (g.attending === true) {
      s.attendingHouseholds += 1;
      s.confirmedPeople += n(g.attendingCount);
    }
    if (g.attending === false) s.declinedHouseholds += 1;
  }
  s.responseRate = s.countedHouseholds > 0 ? s.respondedHouseholds / s.countedHouseholds : 0;
  s.attendanceRate = s.invitedPeople > 0 ? s.confirmedPeople / s.invitedPeople : 0;
  return s;
}
