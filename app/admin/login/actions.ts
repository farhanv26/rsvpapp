"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-session";

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    redirect("/admin/login?error=config");
  }

  if (password !== expected) {
    redirect("/admin/login?error=invalid");
  }

  const token = await createAdminSessionToken();
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
