"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rsvpSchema } from "@/lib/validation";

export async function submitRsvpAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  if (!token) {
    throw new Error("Invalid RSVP link.");
  }

  const guest = await prisma.guest.findUnique({
    where: { token },
    select: { id: true, maxGuests: true, respondedAt: true, eventId: true },
  });

  if (!guest) {
    throw new Error("Invalid RSVP link.");
  }

  if (guest.respondedAt) {
    throw new Error("RSVP is already submitted.");
  }

  const parsed = rsvpSchema.safeParse({
    attending: formData.get("attending"),
    attendingCount: formData.get("attendingCount") || undefined,
    maxGuests: guest.maxGuests,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid RSVP response.");
  }

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      attending: parsed.data.attending === "yes",
      attendingCount:
        parsed.data.attending === "yes" ? parsed.data.attendingCount : null,
      respondedAt: new Date(),
    },
  });

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/admin/events/${guest.eventId}`);
}
