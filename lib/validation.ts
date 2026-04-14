import { z } from "zod";

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Event title is required."),
  description: z.string().trim().optional(),
  coupleNames: z.string().trim().optional(),
  eventSubtitle: z.string().trim().optional(),
  eventDate: z.string().trim().optional(),
  eventTime: z.string().trim().optional(),
  venue: z.string().trim().optional(),
  welcomeMessage: z.string().trim().optional(),
});

export const guestSchema = z
  .object({
    guestName: z.string().trim().min(1, "Guest name is required."),
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
