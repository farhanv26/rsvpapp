"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { assertAllocationFits, getGuestListPermission, lockAllocation, requireOrganizer } from "@/lib/guest-allocation";
import { GuestListPermissionError, invitationPlaces } from "@/lib/guest-permissions";
import { prisma } from "@/lib/prisma";
import { getEventAccess } from "@/lib/wedding-access";

type Outcome = { ok: true; message: string } | { ok: false; error: string };

async function organizerContext(eventId: string) {
  const admin = await requireCurrentAdminUser();
  const access = await getEventAccess(admin, eventId);
  if (access.status !== "ok") throw new GuestListPermissionError("You can't manage this event.", "not_organizer");
  const perm = await getGuestListPermission(admin, eventId);
  requireOrganizer(perm);
  return { admin, event: access.event, perm };
}

async function isWeddingMember(weddingId: string | null, userId: string) {
  if (!weddingId) return false;
  return Boolean(await prisma.weddingMembership.findUnique({ where: { weddingId_userId: { weddingId, userId } }, select: { id: true } }));
}

function finish(eventId: string, outcome: Outcome): never {
  revalidatePath(`/admin/events/${eventId}`);
  const qs = outcome.ok ? `gl_ok=${encodeURIComponent(outcome.message)}` : `gl_error=${encodeURIComponent(outcome.error)}`;
  redirect(`/admin/events/${eventId}?tab=allowances&${qs}`);
}

async function run(eventId: string, fn: () => Promise<string>): Promise<never> {
  let outcome: Outcome;
  try {
    outcome = { ok: true, message: await fn() };
  } catch (error) {
    if (error instanceof GuestListPermissionError) outcome = { ok: false, error: error.message };
    else throw error;
  }
  finish(eventId, outcome);
}

/** Organizer sets someone's role for this event: organizer, contributor, or "none" (back to default). */
export async function setEventGuestRoleAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  await run(eventId, async () => {
    const { admin, event } = await organizerContext(eventId);
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "");
    const canManageAllGuests = formData.get("canManageAllGuests") === "on" || formData.get("canManageAllGuests") === "true";
    if (!(await isWeddingMember(event.weddingId, userId))) {
      throw new GuestListPermissionError("Only members of this wedding can have a role on its events.", "not_organizer");
    }
    if (userId === admin.id && role === "contributor") {
      throw new GuestListPermissionError("You can't make yourself a contributor. Ask another organizer.", "not_organizer");
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    if (role === "none") {
      await prisma.eventRole.deleteMany({ where: { eventId, userId } });
    } else if (role === "organizer" || role === "contributor") {
      await prisma.eventRole.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, role, canManageAllGuests: role === "contributor" && canManageAllGuests },
        update: { role, canManageAllGuests: role === "contributor" && canManageAllGuests },
      });
    } else {
      throw new GuestListPermissionError("Choose a role.", "not_organizer");
    }
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "event_role_updated",
      entityType: "Event",
      entityId: eventId,
      entityName: user.name,
      message: `${admin.name} set ${user.name}'s guest-list role to ${role}${canManageAllGuests && role === "contributor" ? " (can edit all households)" : ""}.`,
    });
    return `${user.name}'s role was updated.`;
  });
}

/** Organizer sets an allowance. It can never drop below places already allocated. */
export async function setGuestAllowanceAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  await run(eventId, async () => {
    const { admin, event } = await organizerContext(eventId);
    const userId = String(formData.get("userId") ?? "");
    const places = Number.parseInt(String(formData.get("places") ?? ""), 10);
    if (!Number.isInteger(places) || places < 0 || places > 100000) {
      throw new GuestListPermissionError("Enter a whole number of places.", "below_usage");
    }
    if (!(await isWeddingMember(event.weddingId, userId))) {
      throw new GuestListPermissionError("Only members of this wedding can have an allowance.", "not_organizer");
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.eventAllocation.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } });
      if (!existing) {
        await tx.eventAllocation.create({ data: { eventId, userId, places } });
        return;
      }
      const { used } = await lockAllocation(tx, existing.id);
      if (places < used) {
        throw new GuestListPermissionError(
          `${user.name} has already allocated ${used} places. Release or move ${used - places} first.`,
          "below_usage",
          { used, requested: places },
        );
      }
      await tx.eventAllocation.update({ where: { id: existing.id }, data: { places } });
    });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "guest_allowance_updated",
      entityType: "Event",
      entityId: eventId,
      entityName: user.name,
      message: `${admin.name} set ${user.name}'s allowance to ${places} places.`,
      metadata: { userId, places },
    });
    return `${user.name} now has ${places} places.`;
  });
}

/** Organizer frees a household's places (for example after it declined). Nothing is released automatically. */
export async function releaseGuestPlacesAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  await run(eventId, async () => {
    const { admin } = await organizerContext(eventId);
    const guestId = String(formData.get("guestId") ?? "");
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId, deletedAt: null, allocationId: { not: null } },
      select: { id: true, guestName: true, maxGuests: true, menCount: true, womenCount: true, kidsCount: true, allocationId: true },
    });
    if (!guest) throw new GuestListPermissionError("That household isn't using an allowance.", "no_allowance");
    await prisma.guest.update({ where: { id: guest.id }, data: { allocationId: null } });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "guest_places_released",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} released ${invitationPlaces(guest)} places held by "${guest.guestName}".`,
      metadata: { allocationId: guest.allocationId },
    });
    return `Released ${invitationPlaces(guest)} places from ${guest.guestName}.`;
  });
}

/** Organizer moves a household to another member's list and allowance (or to the organizer pool). */
export async function reassignGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  await run(eventId, async () => {
    const { admin, event } = await organizerContext(eventId);
    const guestId = String(formData.get("guestId") ?? "");
    const targetUserId = String(formData.get("targetUserId") ?? "");
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId, deletedAt: null },
      select: { id: true, guestName: true, maxGuests: true, menCount: true, womenCount: true, kidsCount: true },
    });
    if (!guest) throw new GuestListPermissionError("Household not found.", "not_your_guest");
    if (targetUserId && !(await isWeddingMember(event.weddingId, targetUserId))) {
      throw new GuestListPermissionError("Choose a member of this wedding.", "not_organizer");
    }
    await prisma.$transaction(async (tx) => {
      const target = targetUserId
        ? await tx.eventAllocation.findUnique({ where: { eventId_userId: { eventId, userId: targetUserId } }, select: { id: true } })
        : null;
      if (target) await assertAllocationFits(tx, target.id, invitationPlaces(guest), [guest.id]);
      await tx.guest.update({
        where: { id: guest.id },
        data: { managedByUserId: targetUserId || null, allocationId: target?.id ?? null },
      });
    });
    await logAuditActivity({
      eventId,
      userId: admin.id,
      userName: admin.name,
      actionType: "guest_reassigned",
      entityType: "Guest",
      entityId: guest.id,
      entityName: guest.guestName,
      message: `${admin.name} moved "${guest.guestName}" to ${targetUserId ? "another member's list" : "the organizer list"}.`,
      metadata: { targetUserId: targetUserId || null },
    });
    return `${guest.guestName} was moved.`;
  });
}
