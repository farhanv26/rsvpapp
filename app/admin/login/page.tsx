import Link from "next/link";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getActiveUsersForLogin } from "@/lib/login-users";

type Props = {
  searchParams: Promise<{ error?: string; user?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error, user } = await searchParams;
  const users = await getActiveUsersForLogin();

  const message =
    error === "invalid"
      ? "Incorrect password. Please try again."
      : error === "config"
        ? "Admin sign-in is not configured on the server."
        : null;

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="app-card flex flex-col justify-between p-7 sm:p-9">
          <div>
            <p className="section-title">RSVP Admin</p>
            <h1 className="headline-display mt-3 text-4xl leading-tight sm:text-5xl">Run events with clarity.</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Manage guests, invites, follow-ups, and RSVP responses in one place. Built for fast operations with
              elegant communication and clear visibility.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Guests</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">Structured lists and status tracking</p>
            </div>
            <div className="rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Invites</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">WhatsApp + email-ready workflows</p>
            </div>
            <div className="rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Dashboard</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">Activity, comms, and RSVP visibility</p>
            </div>
          </div>
        </section>

        <section className="app-card p-7 sm:p-8">
          <p className="section-title">Secure Sign In</p>
          <h2 className="headline-display mt-2 text-3xl">Welcome back</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Select your account and enter your password to continue.
          </p>
          <AdminLoginForm errorMessage={message} initialUser={user} users={users} />
          <p className="mt-5 text-xs text-zinc-500">
            Access is restricted to active admin users. Contact a super admin if you need access.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            <Link href="/admin/login" className="font-medium text-zinc-700 hover:underline">
              Refresh login
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
