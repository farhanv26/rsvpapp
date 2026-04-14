import { describe, expect, it } from "vitest";
import { eventSchema } from "@/lib/validation";

function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function baseEventInput() {
  return {
    title: "Nikkah",
    description: "",
    coupleNames: "",
    eventSubtitle: "",
    eventDate: "",
    rsvpDeadline: "",
    eventTime: "",
    venue: "",
    welcomeMessage: "",
  };
}

describe("Phase 1 - event date/deadline validation", () => {
  it("rejects event date in the past", () => {
    const parsed = eventSchema.safeParse({
      ...baseEventInput(),
      eventDate: dateOffset(-1),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("Event date cannot be in the past.");
    }
  });

  it("allows event date today", () => {
    const parsed = eventSchema.safeParse({
      ...baseEventInput(),
      eventDate: dateOffset(0),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects deadline in the past", () => {
    const parsed = eventSchema.safeParse({
      ...baseEventInput(),
      eventDate: dateOffset(3),
      rsvpDeadline: dateOffset(-1),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("RSVP deadline cannot be in the past.");
    }
  });

  it("rejects deadline after event date", () => {
    const parsed = eventSchema.safeParse({
      ...baseEventInput(),
      eventDate: dateOffset(3),
      rsvpDeadline: dateOffset(4),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("RSVP deadline must be on or before the event date.");
    }
  });

  it("rejects deadline when event date missing", () => {
    const parsed = eventSchema.safeParse({
      ...baseEventInput(),
      rsvpDeadline: dateOffset(2),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        "Set an event date before adding an RSVP deadline.",
      );
    }
  });
});
