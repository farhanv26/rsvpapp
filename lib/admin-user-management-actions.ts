"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { logAuditActivity } from "@/lib/audit-log";
import { notifyUser, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const roleSchema = z.enum(["super_admin", "event_creator"]);

function firstNamePassword(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.toLowerCase();
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  role: roleSchema,
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required.").max(80).optional(),
  role: roleSchema.optional(),
  resetPassword: z.union([z.literal("0"), z.literal("1")]).optional(),
});

const transferSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
});

const deactivateSchema = z.object({
  userId: z.string().min(1),
  transferToUserId: z.string().optional(),
});

const deleteSchema = z
  .object({
    userId: z.string().min(1),
    confirmDelete: z.enum(["1"]).optional(),
  })
  .refine((data) => data.confirmDelete === "1", {
    message: "Confirm deletion before continuing.",
    path: ["confirmDelete"],
  });

async function countOtherActiveSuperAdmins(excludeUserId: string) {
  return prisma.user.count({
    where: {
      role: "super_admin",
      active: true,
      id: { not: excludeUserId },
    },
  });
}

export type UserManageResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createUserAction(
  _prev: UserManageResult | undefined,
  formData: FormData,
): Promise<UserManageResult> {
  const admin = await requireSuperAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const { name, role } = parsed.data;
  const derivedPassword = firstNamePassword(name);
  const passwordHash = await hash(derivedPassword, 12);
  try {
    const created = await prisma.user.create({
      data: { name, passwordHash, role, active: true },
    });
    await logAuditActivity({
      userId: admin.id,
      userName: admin.name,
      actionType: "user_created",
      entityType: "User",
      entityId: created.id,
      entityName: created.name,
      message: `${admin.name} created user "${created.name}" (${role === "super_admin" ? "Super Admin" : "Event Creator"}).`,
      metadata: { role: created.role, active: created.active },
    });
    await notifyUsers({
      userIds: [admin.id, created.id],
      type: "USER_CREATED",
      title: `New account: ${created.name}`,
      description:
        created.id === admin.id
          ? undefined
          : `${admin.name} added a ${role === "super_admin" ? "super admin" : "event creator"} login.`,
      entityType: "User",
      entityId: created.id,
    });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2002") {
      return { ok: false, error: "That name is already taken." };
    }
    throw e;
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/login");
  return { ok: true };
}

export async function updateUserAction(
  _prev: UserManageResult | undefined,
  formData: FormData,
): Promise<UserManageResult> {
  const admin = await requireSuperAdmin();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
    resetPassword: String(formData.get("resetPassword") || "0") as "0" | "1",
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const { id, name, role, resetPassword } = parsed.data;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return { ok: false, error: "User not found." };
  }

  const data: { name?: string; role?: string; passwordHash?: string } = {};
  if (name !== undefined && name !== target.name) {
    data.name = name;
  }
  if (role !== undefined && role !== target.role) {
    if (target.role === "super_admin" && role !== "super_admin") {
      const others = await countOtherActiveSuperAdmins(id);
      if (others < 1) {
        return { ok: false, error: "Cannot change role: this is the only active super admin." };
      }
    }
    data.role = role;
  }
  if (resetPassword === "1") {
    const nextName = data.name ?? target.name;
    data.passwordHash = await hash(firstNamePassword(nextName), 12);
  }

  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
    });
    if (role !== undefined && role !== target.role) {
      await logAuditActivity({
        userId: admin.id,
        userName: admin.name,
        actionType: "user_role_updated",
        entityType: "User",
        entityId: updated.id,
        entityName: updated.name,
        message: `${admin.name} changed "${updated.name}" role from ${target.role} to ${updated.role}.`,
        metadata: { from: target.role, to: updated.role },
      });
      await notifyUsers({
        userIds: [admin.id, updated.id],
        type: "USER_ROLE_UPDATED",
        title: `Role updated for "${updated.name}"`,
        description: `${admin.name} changed the role to ${updated.role === "super_admin" ? "Super Admin" : "Event Creator"}.`,
        entityType: "User",
        entityId: updated.id,
      });
    }
    if (resetPassword === "1") {
      await logAuditActivity({
        userId: admin.id,
        userName: admin.name,
        actionType: "user_password_reset",
        entityType: "User",
        entityId: updated.id,
        entityName: updated.name,
        message: `${admin.name} reset password for "${updated.name}".`,
      });
      await notifyUsers({
        userIds: [admin.id, updated.id],
        type: "USER_PASSWORD_RESET",
        title: `Password reset for "${updated.name}"`,
        description: `${admin.name} reset this account password.`,
        entityType: "User",
        entityId: updated.id,
      });
    }
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2002") {
      return { ok: false, error: "That name is already taken." };
    }
    throw e;
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/login");
  return { ok: true };
}

export async function transferEventsAction(
  _prev: UserManageResult | undefined,
  formData: FormData,
): Promise<UserManageResult> {
  const admin = await requireSuperAdmin();
  const parsed = transferSchema.safeParse({
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid transfer." };
  }
  const { fromUserId, toUserId } = parsed.data;
  if (fromUserId === toUserId) {
    return { ok: false, error: "Source and destination must be different." };
  }
  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId } }),
    prisma.user.findUnique({ where: { id: toUserId } }),
  ]);
  if (!from?.active || !to?.active) {
    return { ok: false, error: "Both users must be active." };
  }
  await prisma.event.updateMany({
    where: { ownerUserId: fromUserId },
    data: { ownerUserId: toUserId },
  });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "event_ownership_transferred",
    entityType: "Event",
    entityId: fromUserId,
    entityName: "Ownership transfer",
    message: `${admin.name} transferred all events from "${from.name}" to "${to.name}".`,
    metadata: { fromUserId, toUserId, fromName: from.name, toName: to.name },
  });
  await notifyUsers({
    userIds: [admin.id, to.id],
    type: "EVENT_OWNERSHIP_TRANSFERRED",
    title: `Events transferred to "${to.name}"`,
    description: `${admin.name} reassigned events from "${from.name}" to "${to.name}".`,
    entityType: "User",
    entityId: to.id,
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/events");
  return { ok: true };
}

export async function deactivateUserAction(
  _prev: UserManageResult | undefined,
  formData: FormData,
): Promise<UserManageResult> {
  const admin = await requireSuperAdmin();
  const parsed = deactivateSchema.safeParse({
    userId: formData.get("userId"),
    transferToUserId: formData.get("transferToUserId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }
  const { userId, transferToUserId } = parsed.data;
  if (userId === admin.id) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { events: true } } },
  });
  if (!target || !target.active) {
    return { ok: false, error: "User not found or already inactive." };
  }

  if (target.role === "super_admin" && (await countOtherActiveSuperAdmins(userId)) < 1) {
    return { ok: false, error: "Cannot deactivate the only active super admin." };
  }

  const eventCount = target._count.events;
  if (eventCount > 0) {
    if (!transferToUserId) {
      return {
        ok: false,
        error: `This user owns ${eventCount} event(s). Choose another user to receive them, or transfer ownership first.`,
      };
    }
    if (transferToUserId === userId) {
      return { ok: false, error: "Invalid recipient." };
    }
    const recipient = await prisma.user.findUnique({ where: { id: transferToUserId } });
    if (!recipient?.active) {
      return { ok: false, error: "Recipient must be an active user." };
    }
    await prisma.$transaction([
      prisma.event.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: transferToUserId },
      }),
      prisma.user.update({ where: { id: userId }, data: { active: false } }),
    ]);
  } else {
    await prisma.user.update({ where: { id: userId }, data: { active: false } });
  }

  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "user_deactivated",
    entityType: "User",
    entityId: target.id,
    entityName: target.name,
    message: `${admin.name} deactivated user "${target.name}".`,
    metadata: { transferredEvents: eventCount, transferToUserId: transferToUserId ?? null },
  });
  await notifyUser({
    userId: admin.id,
    type: "USER_DEACTIVATED",
    title: `User "${target.name}" was deactivated`,
    description:
      eventCount > 0 && transferToUserId
        ? `${eventCount} event(s) were reassigned during deactivation.`
        : `${admin.name} deactivated this account.`,
    entityType: "User",
    entityId: target.id,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/login");
  revalidatePath("/admin/events");
  return { ok: true };
}

export async function deleteUserAction(
  _prev: UserManageResult | undefined,
  formData: FormData,
): Promise<UserManageResult> {
  const admin = await requireSuperAdmin();
  const parsed = deleteSchema.safeParse({
    userId: formData.get("userId"),
    confirmDelete: formData.get("confirmDelete") === "1" ? ("1" as const) : undefined,
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.confirmDelete?.[0] ?? "Invalid request.";
    return { ok: false, error: msg };
  }
  const { userId } = parsed.data;
  if (userId === admin.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { events: true } } },
  });
  if (!target) {
    return { ok: false, error: "User not found." };
  }
  const allowSuperAdminDelete = String(formData.get("allowSuperAdminDelete") || "") === "1";
  if (target.role === "super_admin" && !allowSuperAdminDelete) {
    return { ok: false, error: "Super admin deletion requires explicit confirmation." };
  }
  if (target.role === "super_admin" && (await countOtherActiveSuperAdmins(userId)) < 1) {
    return { ok: false, error: "Cannot delete the only active super admin." };
  }

  const deletedSummary = {
    id: target.id,
    name: target.name,
    role: target.role,
    eventsOwned: target._count.events,
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: userId } });
  });
  await logAuditActivity({
    userId: admin.id,
    userName: admin.name,
    actionType: "user_deleted",
    entityType: "User",
    entityId: deletedSummary.id,
    entityName: deletedSummary.name,
    message: `${admin.name} deleted user "${deletedSummary.name}".`,
    metadata: {
      role: deletedSummary.role,
      eventsOwned: deletedSummary.eventsOwned,
    },
  });
  await notifyUser({
    userId: admin.id,
    type: "USER_DELETED",
    title: `Removed user: ${deletedSummary.name}`,
    description:
      deletedSummary.eventsOwned > 0
        ? `${deletedSummary.eventsOwned} event(s) they owned were deleted with all guest and RSVP data.`
        : `Account permanently removed by ${admin.name}.`,
    entityType: "User",
    entityId: deletedSummary.id,
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/events");
  revalidatePath("/admin/login");
  return { ok: true };
}
