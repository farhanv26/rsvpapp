"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentAdminUser } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getWeddingAccess, hasUnassignedEvents } from "@/lib/wedding-access";
import {
  ACTIVE_WEDDING_ALL,
  ACTIVE_WEDDING_COOKIE,
  ACTIVE_WEDDING_UNASSIGNED,
  isPlatformSuperAdmin,
  parseWeddingRole,
  sanitizeAdminReturnPath,
  wouldLeaveWeddingWithoutOwner,
} from "@/lib/wedding-policy";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

async function setActiveWeddingCookie(value: string) {
  const store = await cookies();
  store.set(ACTIVE_WEDDING_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

function weddingsUrl(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return `/admin/weddings${qs ? `?${qs}` : ""}`;
}

const createWeddingSchema = z.object({
  name: z.string().trim().min(1, "Wedding name is required.").max(120, "Keep the name under 120 characters."),
});

export async function createWeddingAction(formData: FormData) {
  const admin = await requireCurrentAdminUser();
  const parsed = createWeddingSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(weddingsUrl({ error: "invalid_name" }));
  }

  const wedding = await prisma.wedding.create({
    data: {
      name: parsed.data.name,
      memberships: { create: { userId: admin.id, role: "owner" } },
    },
    select: { id: true, name: true },
  });

  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "wedding_created",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: wedding.name,
    message: `${admin.name} created wedding workspace "${wedding.name}".`,
  });

  await setActiveWeddingCookie(wedding.id);
  revalidatePath("/admin", "layout");
  redirect("/admin/overview");
}

export async function selectActiveWeddingAction(formData: FormData) {
  const admin = await requireCurrentAdminUser();
  const value = String(formData.get("weddingId") ?? "").trim();
  const returnTo = sanitizeAdminReturnPath(formData.get("returnTo"));

  if (value === ACTIVE_WEDDING_ALL && isPlatformSuperAdmin(admin)) {
    await setActiveWeddingCookie(ACTIVE_WEDDING_ALL);
  } else if (value === ACTIVE_WEDDING_UNASSIGNED && (isPlatformSuperAdmin(admin) || (await hasUnassignedEvents(admin)))) {
    await setActiveWeddingCookie(ACTIVE_WEDDING_UNASSIGNED);
  } else {
    const access = await getWeddingAccess(admin, value);
    if (access.status !== "ok") {
      redirect("/admin/events?error=forbidden");
    }
    await setActiveWeddingCookie(access.wedding.id);
  }

  revalidatePath("/admin", "layout");
  redirect(returnTo);
}

const addMemberSchema = z.object({
  weddingId: z.string().trim().min(1),
  userName: z.string().trim().min(1).max(80),
  role: z.enum(["owner", "member"]),
});

export async function addWeddingMemberAction(formData: FormData) {
  const admin = await requireCurrentAdminUser();
  const parsed = addMemberSchema.safeParse({
    weddingId: formData.get("weddingId"),
    userName: formData.get("userName"),
    role: formData.get("role") || "member",
  });
  if (!parsed.success) {
    redirect(weddingsUrl({ error: "invalid_member" }));
  }
  const { weddingId, userName, role } = parsed.data;

  const access = await getWeddingAccess(admin, weddingId, { require: "owner" });
  if (access.status !== "ok") {
    redirect(weddingsUrl({ error: "owner_required" }));
  }

  const target = await prisma.user.findFirst({
    where: { name: userName, active: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!target) {
    redirect(weddingsUrl({ w: weddingId, error: "user_not_found" }));
  }

  const existing = await prisma.weddingMembership.findUnique({
    where: { weddingId_userId: { weddingId, userId: target.id } },
    select: { id: true },
  });
  if (existing) {
    redirect(weddingsUrl({ w: weddingId, error: "already_member" }));
  }

  await prisma.weddingMembership.create({ data: { weddingId, userId: target.id, role } });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "wedding_member_added",
    entityType: "Wedding",
    entityId: weddingId,
    entityName: access.wedding.name,
    message: `${admin.name} added ${target.name} to "${access.wedding.name}" as ${role}.`,
    metadata: { userId: target.id, role },
  });

  revalidatePath("/admin/weddings");
  redirect(weddingsUrl({ w: weddingId, saved: "member_added" }));
}

async function loadMembershipForOwnerAction(membershipId: string) {
  const admin = await requireCurrentAdminUser();
  const membership = await prisma.weddingMembership.findUnique({
    where: { id: membershipId },
    select: { id: true, weddingId: true, userId: true, role: true, user: { select: { name: true } } },
  });
  if (!membership) {
    redirect(weddingsUrl({ error: "member_not_found" }));
  }
  const access = await getWeddingAccess(admin, membership.weddingId, { require: "owner" });
  if (access.status !== "ok") {
    redirect(weddingsUrl({ error: "owner_required" }));
  }
  const all = await prisma.weddingMembership.findMany({
    where: { weddingId: membership.weddingId },
    select: { id: true, userId: true, role: true },
  });
  return { admin, membership, wedding: access.wedding, all };
}

export async function updateWeddingMemberRoleAction(formData: FormData) {
  const membershipId = String(formData.get("membershipId") ?? "");
  const nextRole = parseWeddingRole(formData.get("role"));
  if (!nextRole) {
    redirect(weddingsUrl({ error: "invalid_member" }));
  }
  const { admin, membership, wedding, all } = await loadMembershipForOwnerAction(membershipId);
  if (membership.role === nextRole) {
    redirect(weddingsUrl({ w: wedding.id }));
  }
  if (wouldLeaveWeddingWithoutOwner(all, { membershipId, nextRole })) {
    redirect(weddingsUrl({ w: wedding.id, error: "last_owner" }));
  }

  await prisma.weddingMembership.update({ where: { id: membershipId }, data: { role: nextRole } });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "wedding_member_role_updated",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: wedding.name,
    message: `${admin.name} changed ${membership.user.name}'s role in "${wedding.name}" to ${nextRole}.`,
    metadata: { userId: membership.userId, from: membership.role, to: nextRole },
  });

  revalidatePath("/admin/weddings");
  redirect(weddingsUrl({ w: wedding.id, saved: "role_updated" }));
}

export async function removeWeddingMemberAction(formData: FormData) {
  const membershipId = String(formData.get("membershipId") ?? "");
  const { admin, membership, wedding, all } = await loadMembershipForOwnerAction(membershipId);
  if (wouldLeaveWeddingWithoutOwner(all, { membershipId, nextRole: null })) {
    redirect(weddingsUrl({ w: wedding.id, error: "last_owner" }));
  }

  await prisma.weddingMembership.delete({ where: { id: membershipId } });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "wedding_member_removed",
    entityType: "Wedding",
    entityId: wedding.id,
    entityName: wedding.name,
    message: `${admin.name} removed ${membership.user.name} from "${wedding.name}".`,
    metadata: { userId: membership.userId, role: membership.role },
  });

  revalidatePath("/admin", "layout");
  redirect(weddingsUrl(membership.userId === admin.id && !isPlatformSuperAdmin(admin) ? {} : { w: wedding.id, saved: "member_removed" }));
}
