import { describe, expect, it } from "vitest";
import { summarizeWeddingGuests, type WeddingSummaryGuest } from "@/lib/wedding-guest-summary";

function guest(partial: Partial<WeddingSummaryGuest> & Pick<WeddingSummaryGuest, "id" | "eventId">): WeddingSummaryGuest {
  return {
    sharedGuestKey: null,
    maxGuests: 0,
    menCount: 0,
    womenCount: 0,
    kidsCount: 0,
    attending: null,
    attendingCount: null,
    excludeFromTotals: false,
    excludeReason: null,
    excludedGuestCount: 0,
    excludedMenCount: 0,
    excludedWomenCount: 0,
    excludedKidsCount: 0,
    ...partial,
  };
}

describe("summarizeWeddingGuests", () => {
  const khanMehndi = guest({ id: "1", eventId: "mehndi", sharedGuestKey: "n:khan", menCount: 2, womenCount: 2, attending: true, attendingCount: 3 });
  const khanReception = guest({ id: "2", eventId: "reception", sharedGuestKey: "n:khan", menCount: 2, womenCount: 3, attending: true, attendingCount: 5 });

  it("adds a household attending Mehndi and the reception to both events, but counts its people once", () => {
    const summary = summarizeWeddingGuests([
      khanMehndi,
      khanReception,
      guest({ id: "3", eventId: "reception", sharedGuestKey: "n:ali", maxGuests: 2, attending: false }),
      guest({ id: "4", eventId: "reception", menCount: 1 }),
    ]);
    expect(summary).toEqual({
      eventCount: 2,
      invitationRecords: 4,
      invitedAcrossEvents: 4 + 5 + 2 + 1,
      confirmedAcrossEvents: 3 + 5,
      uniqueHouseholds: 3,
      householdsInMultipleEvents: 1,
      uniqueInvitedPeople: 5 + 2 + 1,
      uniqueConfirmedAttendees: 5,
    });
  });

  it("ignores old automatic duplicate exclusions but honours manual ones", () => {
    const legacyAuto = {
      ...khanReception,
      excludeFromTotals: true,
      excludeReason: "Duplicate guest in another event",
      excludedGuestCount: 5,
      excludedMenCount: 2,
      excludedWomenCount: 3,
    };
    expect(summarizeWeddingGuests([khanMehndi, legacyAuto]).confirmedAcrossEvents).toBe(8);

    const manual = { ...legacyAuto, excludeReason: "Hosting family, not counted" };
    const summary = summarizeWeddingGuests([khanMehndi, manual]);
    expect(summary.invitedAcrossEvents).toBe(4);
    expect(summary.confirmedAcrossEvents).toBe(3);
  });
});
