"use server";

import { revalidatePath } from "next/cache";
import { getOptionalAdminUser, isSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";
import { dispatchEventCommunication } from "@/lib/communications";
import { rsvpSchema } from "@/lib/validation";

export async function submitRsvpAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  if (!token) {
    throw new Error("Invalid RSVP link.");
  }

  const guest = await prisma.guest.findFirst({
    where: { token, deletedAt: null, event: { deletedAt: null } },
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
          title: true,
          coupleNames: true,
          ownerUserId: true,
        },
      },
    },
  });

  if (!guest) {
    throw new Error("Invalid RSVP link.");
  }

  const previewFlag = formData.get("previewMode") === "1";
  if (previewFlag) {
    const admin = await getOptionalAdminUser();
    if (
      admin &&
      (isSuperAdmin(admin) || guest.event.ownerUserId === admin.id)
    ) {
      throw new Error("RSVP submission is disabled in preview mode.");
    }
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
    hostMessage: formData.get("hostMessage") || undefined,
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
      hostMessage: parsed.data.hostMessage?.trim() || null,
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

  await logAuditActivity({
    eventId: guest.eventId,
    userId: null,
    userName: guest.guestName,
    actionType: wasResponded ? "rsvp_updated" : "rsvp_submitted",
    entityType: "RSVP",
    entityId: guest.id,
    entityName: guest.guestName,
    message: wasResponded
      ? `${guest.guestName} updated RSVP (${nextAttending ? `${nextAttendingCount ?? 0} attending` : "declined"}).`
      : `${guest.guestName} submitted RSVP (${nextAttending ? `${nextAttendingCount ?? 0} attending` : "declined"}).`,
    metadata: {
      attending: nextAttending,
      attendingCount: nextAttendingCount ?? 0,
      changeType: type,
      respondedAt: now.toISOString(),
    },
  });
  const eventDisplay = guest.event.coupleNames?.trim() || guest.event.title || "your event";
  await dispatchEventCommunication({
    trigger: wasResponded ? "rsvp_updated" : "rsvp_submitted",
    eventId: guest.eventId,
    entityType: "RSVP",
    entityId: guest.id,
    title: wasResponded
      ? `${guest.guestName} updated RSVP · ${eventDisplay}`
      : nextAttending
        ? `${guest.guestName} RSVP’d — ${nextAttendingCount ?? 0} attending · ${eventDisplay}`
        : `${guest.guestName} declined · ${eventDisplay}`,
    description: nextAttending
      ? `Open the guest list if you need to adjust seating or follow up.`
      : `They declined for ${eventDisplay}.`,
    guestName: guest.guestName,
    attendingLabel: nextAttending ? "Attending" : "Declined",
    attendingCount: nextAttendingCount,
    hostMessage: parsed.data.hostMessage?.trim() || null,
    actorName: guest.guestName,
    metadata: {
      eventTitle: guest.event.title,
      respondedAt: now.toISOString(),
      changeType: type,
    },
  });

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/admin/events/${guest.eventId}`);
}
