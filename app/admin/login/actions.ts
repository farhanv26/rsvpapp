"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-session";
import { authenticateAdminCredentials } from "@/lib/login-credentials";

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const adminUser = String(formData.get("adminUser") ?? "");
  const user = await authenticateAdminCredentials(adminUser, password);
  if (!user) redirect("/admin/login?error=invalid");

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
  redirect("/admin/overview");
}

export async function logoutAdminAction() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect("/admin/login");
}
