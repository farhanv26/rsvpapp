import { countedBreakdown, type AttendanceGuest } from "./attendance";

/**
 * Wedding-wide totals, reported two ways:
 * - "across events": the sum of each event's own totals. A household at Mehndi and the
 *   reception contributes to both, exactly as each event's dashboard shows it.
 * - "unique": each household counted once (keyed by `sharedGuestKey`, or the guest id when no
 *   key exists), using its largest party size across events.
 * Callers must only pass guests from a single wedding.
 */
export type WeddingSummaryGuest = AttendanceGuest & {
  id: string;
  eventId: string;
  sharedGuestKey: string | null;
  attending: boolean | null;
  attendingCount: number | null;
};

export type WeddingGuestSummary = {
  eventCount: number;
  invitationRecords: number;
  invitedAcrossEvents: number;
  confirmedAcrossEvents: number;
  uniqueHouseholds: number;
  householdsInMultipleEvents: number;
  uniqueInvitedPeople: number;
  uniqueConfirmedAttendees: number;
};

export function summarizeWeddingGuests(guests: WeddingSummaryGuest[]): WeddingGuestSummary {
  const households = new Map<string, { events: Set<string>; invited: number; confirmed: number }>();
  const events = new Set<string>();
  let invitedAcrossEvents = 0;
  let confirmedAcrossEvents = 0;

  for (const g of guests) {
    events.add(g.eventId);
    const counted = countedBreakdown(g).total;
    if (counted <= 0) continue;
    const confirmed =
      g.attending === true && typeof g.attendingCount === "number" && Number.isFinite(g.attendingCount)
        ? Math.max(g.attendingCount, 0)
        : 0;
    invitedAcrossEvents += counted;
    confirmedAcrossEvents += confirmed;

    const key = g.sharedGuestKey ? `k:${g.sharedGuestKey}` : `g:${g.id}`;
    const entry = households.get(key) ?? { events: new Set<string>(), invited: 0, confirmed: 0 };
    entry.events.add(g.eventId);
    entry.invited = Math.max(entry.invited, counted);
    entry.confirmed = Math.max(entry.confirmed, confirmed);
    households.set(key, entry);
  }

  let householdsInMultipleEvents = 0;
  let uniqueInvitedPeople = 0;
  let uniqueConfirmedAttendees = 0;
  for (const entry of households.values()) {
    if (entry.events.size > 1) householdsInMultipleEvents += 1;
    uniqueInvitedPeople += entry.invited;
    uniqueConfirmedAttendees += entry.confirmed;
  }

  return {
    eventCount: events.size,
    invitationRecords: guests.length,
    invitedAcrossEvents,
    confirmedAcrossEvents,
    uniqueHouseholds: households.size,
    householdsInMultipleEvents,
    uniqueInvitedPeople,
    uniqueConfirmedAttendees,
  };
}
