"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAdminAction } from "@/app/admin/login/actions";
import { formatAdminRoleLabel } from "@/lib/admin-roles";

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
  initialUser,
  users,
}: {
  errorMessage: string | null;
  initialUser?: string;
  users: Array<{ name: string; role: string }>;
}) {
  const safeInitial =
    initialUser && users.some((u) => u.name === initialUser) ? initialUser : users[0]?.name ?? "";
  const [selectedUser, setSelectedUser] = useState(safeInitial);
  const [showPassword, setShowPassword] = useState(false);

  const roleLabel = useMemo(() => {
    const match = users.find((u) => u.name === selectedUser);
    return match ? formatAdminRoleLabel(match.role) : "";
  }, [selectedUser, users]);

  if (users.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          No active admin accounts are available. Ask a super admin to add you, or run{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">pnpm db:seed</code> to bootstrap the default
          super admin.
        </p>
      </div>
    );
  }

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
          onChange={(e) => setSelectedUser(e.target.value)}
          className="input-luxe mt-2"
        >
          {users.map((user) => (
            <option key={user.name} value={user.name}>
              {user.name}
            </option>
          ))}
        </select>
        {roleLabel ? <p className="mt-2 text-xs text-zinc-500">{roleLabel}</p> : null}
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
