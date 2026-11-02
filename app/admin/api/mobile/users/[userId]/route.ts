import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";
import { weddingsWhereSoleOwner } from "@/lib/admin-user-management-actions";

type Params = { params: Promise<{ userId: string }> };

/** PUT /admin/api/mobile/users/[userId] — update role or active status. */
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();
  if (!isMobileSuperAdmin(user)) return forbiddenResponse();

  const { userId } = await params;

  const target = await withReconnect(() =>
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, role: true, active: true },
    })
  );
  if (!target) return notFoundResponse("User not found");

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.role === "string" && ["super_admin", "event_creator"].includes(body.role)) {
    data.role = body.role;
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }
  if (data.active === false) {
    const soleOwnerOf = await weddingsWhereSoleOwner(userId);
    if (soleOwnerOf.length > 0) {
      return Response.json(
        { error: `${target.name} is the only owner of ${soleOwnerOf.map((w) => `"${w.name}"`).join(", ")}. Make another member an owner first.` },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, role: true, active: true, createdAt: true },
    });

    const changes = Object.keys(data).join(", ");
    await logAuditActivity({
      userId: user.id,
      userName: user.name,
      actionType: data.role ? "user_role_updated" : data.active === false ? "user_deactivated" : "user_updated",
      entityType: "User",
      entityId: userId,
      entityName: target.name,
      message: `${user.name} updated user "${target.name}" (${changes}) via mobile.`,
      metadata: { changes: Object.keys(data) },
    });

    const eventCount = await prisma.event.count({ where: { ownerUserId: userId, deletedAt: null, weddingId: null } });

    return Response.json({
      user: { ...updated, createdAt: updated.createdAt.toISOString(), eventCount },
    });
  } catch (err) {
    console.error("[mobile/user PUT]", err);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/** DELETE /admin/api/mobile/users/[userId] — soft-delete user. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();
  if (!isMobileSuperAdmin(user)) return forbiddenResponse();

  const { userId } = await params;
  if (userId === user.id) return Response.json({ error: "Cannot delete your own account" }, { status: 400 });

  const target = await withReconnect(() =>
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true },
    })
  );
  if (!target) return notFoundResponse("User not found");
  const soleOwnerOf = await weddingsWhereSoleOwner(userId);
  if (soleOwnerOf.length > 0) {
    return Response.json(
      { error: `${target.name} is the only owner of ${soleOwnerOf.map((w) => `"${w.name}"`).join(", ")}. Make another member an owner first.` },
      { status: 409 },
    );
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), active: false } });

    await logAuditActivity({
      userId: user.id,
      userName: user.name,
      actionType: "user_deleted",
      entityType: "User",
      entityId: userId,
      entityName: target.name,
      message: `${user.name} deleted user "${target.name}" via mobile.`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[mobile/user DELETE]", err);
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
