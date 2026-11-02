"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { loginAdminAction } from "@/app/admin/login/actions";

const MRU_STORAGE_KEY = "rsvp_admin_user_mru_v1";
const subscribeToNothing = () => () => {};
function readMru() {
  try {
    return localStorage.getItem(MRU_STORAGE_KEY);
  } catch {
    return null;
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
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
  const [selectedUser, setSelectedUser] = useState(() =>
    initialUser && users.some((u) => u.name === initialUser) ? initialUser : "",
  );
  const [showPassword, setShowPassword] = useState(false);
  const mruRaw = useSyncExternalStore(subscribeToNothing, readMru, () => null);

  const orderedUsers = useMemo(() => {
    const validNames = new Set(users.map((u) => u.name));
    let mru: string[] = [];
    try {
      const parsed = mruRaw ? JSON.parse(mruRaw) : [];
      if (Array.isArray(parsed)) {
        mru = parsed.filter((name): name is string => typeof name === "string" && validNames.has(name));
      }
    } catch {
      mru = [];
    }
    const orderIndex = new Map<string, number>(mru.map((name, idx) => [name, idx]));
    return [...users].sort((a, b) => {
      const ai = orderIndex.get(a.name) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(b.name) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }, [mruRaw, users]);

  if (users.length === 0) {
    return (
      <p className="notice-info mt-5" role="status">
        No accounts are set up yet. Ask your account administrator to add you.
      </p>
    );
  }

  return (
    <form action={loginAdminAction} className="mt-5 space-y-4">
      <div>
        <label className="form-label" htmlFor="adminUser">
          Account
        </label>
        <select
          id="adminUser"
          name="adminUser"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="input-luxe"
          required
        >
          <option value="">Choose your name</option>
          {orderedUsers.map((user) => (
            <option key={user.name} value={user.name}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoFocus={Boolean(initialUser)}
            required
            className="input-luxe pr-16"
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={errorMessage ? "login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-1 my-auto h-8 rounded-md px-2 text-[13px] font-medium text-[var(--muted-text)] hover:text-[var(--foreground)]"
            aria-controls="password"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {errorMessage ? (
          <p id="login-error" className="field-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
