import { compare } from "bcryptjs";
import type { NextRequest } from "next/server";
import { createAdminSessionToken } from "@/lib/admin-session";
import { getMobileAdminUser, unauthorizedResponse } from "@/lib/mobile-api-auth";
import { prisma, withReconnect } from "@/lib/prisma";

/** POST /admin/api/mobile/auth — login with username+password, returns JWT. */
export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return Response.json({ error: "username and password are required" }, { status: 400 });
  }

  try {
    const user = await withReconnect(() =>
      prisma.user.findFirst({
        where: { name: username, deletedAt: null },
        select: { id: true, name: true, role: true, passwordHash: true, active: true },
      })
    );

    if (!user || !user.active) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createAdminSessionToken({
      userId: user.id,
      name: user.name,
      userRole: user.role === "super_admin" ? "super_admin" : "event_creator",
    });

    return Response.json({
      token,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("[mobile/auth POST]", err);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}

/** GET /admin/api/mobile/auth — return current authenticated user. */
export async function GET(req: NextRequest) {
  const user = await getMobileAdminUser(req);
  if (!user) return unauthorizedResponse();
  return Response.json({ user });
}
