"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const roleSchema = z.enum(["super_admin", "event_creator"]);

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: roleSchema,
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required.").max(80).optional(),
  role: roleSchema.optional(),
  newPassword: z.union([
    z.literal(""),
    z.string().min(8, "New password must be at least 8 characters."),
  ]),
});

const transferSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
});

const deactivateSchema = z.object({
  userId: z.string().min(1),
  transferToUserId: z.string().optional(),
});

const deleteSchema = z.object({
  userId: z.string().min(1),
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
  await requireSuperAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const { name, password, role } = parsed.data;
  const passwordHash = await hash(password, 12);
  try {
    await prisma.user.create({
      data: { name, passwordHash, role, active: true },
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
  await requireSuperAdmin();
  const rawPassword = String(formData.get("newPassword") ?? "");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
    newPassword: rawPassword,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }
  const { id, name, role, newPassword } = parsed.data;
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
  if (newPassword && newPassword.length >= 8) {
    data.passwordHash = await hash(newPassword, 12);
  }

  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  try {
    await prisma.user.update({
      where: { id },
      data,
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

export async function transferEventsAction(
  _prev: UserManageResult | undefined,
  formData: FormData,
): Promise<UserManageResult> {
  await requireSuperAdmin();
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
  const parsed = deleteSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
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
  if (target._count.events > 0) {
    return {
      ok: false,
      error: `Cannot delete: this user still owns ${target._count.events} event(s). Transfer ownership first, or deactivate instead.`,
    };
  }
  if (target.role === "super_admin" && (await countOtherActiveSuperAdmins(userId)) < 1) {
    return { ok: false, error: "Cannot delete the only active super admin." };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  revalidatePath("/admin/login");
  return { ok: true };
}
