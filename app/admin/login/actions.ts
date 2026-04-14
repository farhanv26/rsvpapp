"use server";

import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const adminUser = String(formData.get("adminUser") ?? "").trim();
  if (!adminUser) {
    redirect("/admin/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { name: adminUser },
    select: { id: true, name: true, role: true, passwordHash: true },
  });

  if (!user) {
    redirect(`/admin/login?error=invalid&user=${encodeURIComponent(adminUser)}`);
  }
  const validPassword = await compare(password, user.passwordHash);
  if (!validPassword) {
    redirect(`/admin/login?error=invalid&user=${encodeURIComponent(adminUser)}`);
  }

  const token = await createAdminSessionToken({
    userId: user.id,
    name: user.name,
    userRole: user.role === "super_admin" ? "super_admin" : "event_creator",
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/admin/events");
}

export async function logoutAdminAction() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect("/admin/login");
}
