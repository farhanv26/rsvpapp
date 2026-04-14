"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAdminAction } from "@/app/admin/login/actions";
import { ADMIN_IDENTITIES } from "@/lib/admin-identities";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-2 w-full" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function AdminLoginForm({
  errorMessage,
  initialUser = "Farhan",
}: {
  errorMessage: string | null;
  initialUser?: string;
}) {
  const fallbackUser = ADMIN_IDENTITIES.some((user) => user.name === initialUser) ? initialUser : "Farhan";
  const [selectedUser, setSelectedUser] = useState<string>(fallbackUser);
  const [showPassword, setShowPassword] = useState(false);

  const roleLabel = useMemo(
    () =>
      ADMIN_IDENTITIES.find((user) => user.name === selectedUser)?.role === "super_admin"
        ? "Super Admin"
        : "Event Creator",
    [selectedUser],
  );

  return (
    <form action={loginAdminAction} className="mt-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-700" htmlFor="adminUser">
          Admin user
        </label>
        <select
          id="adminUser"
          name="adminUser"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value as (typeof USERS)[number]["name"])}
          className="input-luxe mt-2"
        >
          {ADMIN_IDENTITIES.map((user) => (
            <option key={user.name} value={user.name}>
              {user.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-zinc-500">{roleLabel}</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-zinc-700" htmlFor="password">
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="text-xs font-medium text-zinc-600 transition hover:text-zinc-900"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className="input-luxe mt-2"
          placeholder="Enter password"
        />
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
