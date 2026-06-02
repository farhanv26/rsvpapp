import type { NextRequest } from "next/server";
import {
  getMobileAdminUser,
  isMobileSuperAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";
import { logAuditActivity } from "@/lib/audit-log";
import { hash } from "bcryptjs";

/** GET /admin/api/mobile/users — list all users (super admin only). */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();
  if (!isMobileSuperAdmin(user)) return forbiddenResponse();

  try {
    const users = await withReconnect(() =>
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
          _count: { select: { events: { where: { deletedAt: null } } } },
        },
      })
    );

    return Response.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt.toISOString(),
        eventCount: u._count.events,
      })),
    });
  } catch (err) {
    console.error("[mobile/users GET]", err);
    return Response.json({ error: "Failed to load users" }, { status: 500 });
  }
}

/** POST /admin/api/mobile/users — create a new user (super admin only). */
export async function POST(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();
  if (!isMobileSuperAdmin(user)) return forbiddenResponse();

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name as string | undefined)?.trim();
  const password = (body.password as string | undefined)?.trim();
  const role = (body.role as string | undefined) ?? "event_creator";

  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  if (!password || password.length < 8) return Response.json({ error: "password must be at least 8 characters" }, { status: 400 });
  if (!["super_admin", "event_creator"].includes(role)) return Response.json({ error: "invalid role" }, { status: 400 });

  try {
    const passwordHash = await hash(password, 12);
    const created = await prisma.user.create({
      data: { name, passwordHash, role, active: true },
      select: { id: true, name: true, role: true, active: true, createdAt: true },
    });

    await logAuditActivity({
      userId: user.id,
      userName: user.name,
      actionType: "user_created",
      entityType: "User",
      entityId: created.id,
      entityName: created.name,
      message: `${user.name} created user "${created.name}" via mobile.`,
      metadata: { role },
    });

    return Response.json({
      user: { ...created, createdAt: created.createdAt.toISOString(), eventCount: 0 },
    }, { status: 201 });
  } catch (err) {
    console.error("[mobile/users POST]", err);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
