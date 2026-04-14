import Link from "next/link";
import { loginAdminAction } from "@/app/admin/login/actions";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  const message =
    error === "invalid"
      ? "That password is not correct."
      : error === "config"
        ? "Admin password is not configured on the server."
        : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="app-card w-full max-w-md p-8">
        <p className="section-title">Private admin</p>
        <h1 className="headline-display mt-2 text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">Enter the admin password to manage events and guest lists.</p>

        {message ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {message}
          </p>
        ) : null}

        <form action={loginAdminAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-zinc-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-luxe mt-2"
          />
          <button type="submit" className="btn-primary w-full">
            Continue
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="font-medium text-zinc-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
