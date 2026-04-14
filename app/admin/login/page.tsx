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
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="w-full max-w-md">
        <div className="app-card p-7 sm:p-8">
          <p className="section-title">Event Dashboard</p>
          <h1 className="headline-display mt-2 text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Sign in to manage your events and guest lists.
          </p>

          <AdminLoginForm errorMessage={message} initialUser={user} users={users} />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="font-medium text-zinc-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
