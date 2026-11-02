import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getActiveUsersForLogin } from "@/lib/login-users";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<{ error?: string; user?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error, user } = await searchParams;
  const users = await getActiveUsersForLogin();

  const message =
    error === "invalid"
      ? "Incorrect password. Try again."
      : error === "config"
        ? "Sign-in isn’t available right now. Try again later."
        : null;

  return (
    <main className="flex min-h-dvh flex-col items-center px-5 pt-[12vh] pb-10 sm:justify-center sm:pt-10">
      <div className="w-full max-w-[22rem]">
        <p className="text-sm font-semibold tracking-tight">Wedding planner</p>
        <div className="mt-8 sm:rounded-xl sm:border sm:border-[var(--border-soft)] sm:bg-[var(--surface)] sm:p-7">
          <h1 className="page-title">Sign in</h1>
          <AdminLoginForm key={user ?? ""} errorMessage={message} initialUser={user} users={users} />
        </div>
        <p className="mt-6 text-[13px] text-[var(--muted-text)] sm:px-7">
          Need access or a new password? Ask your account administrator.
        </p>
      </div>
    </main>
  );
}
