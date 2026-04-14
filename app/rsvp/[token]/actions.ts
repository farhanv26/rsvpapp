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
    select: {
      id: true,
      maxGuests: true,
      respondedAt: true,
      eventId: true,
      guestName: true,
      attending: true,
      attendingCount: true,
      event: {
        select: {
          rsvpDeadline: true,
        },
      },
    },
  });

  if (!guest) {
    throw new Error("Invalid RSVP link.");
  }

  if (guest.event.rsvpDeadline) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d = guest.event.rsvpDeadline;
    const deadlineDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (today > deadlineDate) {
      throw new Error("RSVP is now closed.");
    }
  }

  const parsed = rsvpSchema.safeParse({
    attending: formData.get("attending"),
    attendingCount: formData.get("attendingCount") || undefined,
    maxGuests: guest.maxGuests,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid RSVP response.");
  }

  const nextAttending = parsed.data.attending === "yes";
  const nextAttendingCount = nextAttending ? parsed.data.attendingCount ?? null : null;
  const now = new Date();

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      attending: nextAttending,
      attendingCount: nextAttendingCount,
      respondedAt: now,
    },
  });

  const wasResponded = Boolean(guest.respondedAt);
  let type = "rsvp_submitted";
  let description = `${guest.guestName} submitted RSVP.`;

  if (!wasResponded) {
    if (nextAttending) {
      type = "accepted";
      description = `${guest.guestName} accepted with ${nextAttendingCount ?? 0} guest(s).`;
    } else {
      type = "declined";
      description = `${guest.guestName} declined the invitation.`;
    }
  } else if (guest.attending !== nextAttending) {
    if (nextAttending) {
      type = "changed_to_attending";
      description = `${guest.guestName} changed RSVP from declined to attending (${nextAttendingCount ?? 0} guest(s)).`;
    } else {
      type = "changed_to_declined";
      description = `${guest.guestName} changed RSVP from attending to declined.`;
    }
  } else if (nextAttending && guest.attendingCount !== nextAttendingCount) {
    type = "updated_attendee_count";
    description = `${guest.guestName} updated attendee count from ${guest.attendingCount ?? 0} to ${nextAttendingCount ?? 0}.`;
  } else {
    type = "updated_response";
    description = `${guest.guestName} updated RSVP response.`;
  }

  await prisma.rsvpActivity.create({
    data: {
      eventId: guest.eventId,
      guestId: guest.id,
      type,
      description,
    },
  });

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/admin/events/${guest.eventId}`);
}
