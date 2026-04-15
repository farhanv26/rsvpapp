import { z } from "zod";

function parseLocalDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Event title is required."),
  theme: z.enum(["modern", "floral"]).default("modern"),
  description: z.string().trim().optional(),
  coupleNames: z.string().trim().optional(),
  eventSubtitle: z.string().trim().optional(),
  eventDate: z.string().trim().min(1, "Event date is required."),
  rsvpDeadline: z.string().trim().min(1, "RSVP deadline is required."),
  eventTime: z.string().trim().min(1, "Event time is required."),
  venue: z.string().trim().optional(),
  welcomeMessage: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const eventDateText = data.eventDate?.trim();
  const deadlineText = data.rsvpDeadline?.trim();

  let eventDate: Date | null = null;
  let deadlineDate: Date | null = null;

  if (eventDateText) {
    eventDate = parseLocalDateOnly(eventDateText);
  }
  if (deadlineText) {
    deadlineDate = parseLocalDateOnly(deadlineText);
  }

  if (eventDateText && !eventDate) {
    ctx.addIssue({
      code: "custom",
      message: "Invalid event date.",
      path: ["eventDate"],
    });
  }
  if (deadlineText && !deadlineDate) {
    ctx.addIssue({
      code: "custom",
      message: "Invalid RSVP deadline.",
      path: ["rsvpDeadline"],
    });
  }

  if (eventDate && eventDate < startOfTodayLocal()) {
    ctx.addIssue({
      code: "custom",
      message: "Event date cannot be in the past.",
      path: ["eventDate"],
    });
  }

  if (deadlineDate && deadlineDate < startOfTodayLocal()) {
    ctx.addIssue({
      code: "custom",
      message: "RSVP deadline cannot be in the past.",
      path: ["rsvpDeadline"],
    });
  }

  if (eventDate && deadlineDate && deadlineDate > eventDate) {
    ctx.addIssue({
      code: "custom",
      message: "RSVP deadline must be on or before the event date.",
      path: ["rsvpDeadline"],
    });
  }

});

export const guestSchema = z
  .object({
    guestName: z.string().trim().min(1, "Guest name is required."),
    greeting: z.string().trim().max(80, "Greeting must be 80 characters or less.").optional(),
    maxGuests: z.coerce.number().int().min(1, "Max guests must be at least 1."),
    group: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const e = data.email?.trim();
    if (e) {
      const ok = z.string().email().safeParse(e);
      if (!ok.success) {
        ctx.addIssue({ code: "custom", message: "Invalid email address.", path: ["email"] });
      }
    }
  });

export const rsvpSchema = z
  .object({
    attending: z.enum(["yes", "no"]),
    attendingCount: z.coerce.number().int().optional(),
    maxGuests: z.coerce.number().int().min(1),
  hostMessage: z.string().trim().max(500, "Message must be 500 characters or less.").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.attending === "yes") {
      if (!value.attendingCount) {
        ctx.addIssue({
          code: "custom",
          message: "Please choose how many guests will attend.",
          path: ["attendingCount"],
        });
        return;
      }

      if (value.attendingCount < 1 || value.attendingCount > value.maxGuests) {
        ctx.addIssue({
          code: "custom",
          message: `Attending count must be between 1 and ${value.maxGuests}.`,
          path: ["attendingCount"],
        });
      }
    }
  });
