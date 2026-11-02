"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAdminAction } from "@/app/admin/login/actions";

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
}: {
  errorMessage: string | null;
  initialUser?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAdminAction} className="mt-5 space-y-4">
      <div>
        <label className="form-label" htmlFor="adminUser">
          Account name
        </label>
        <input
          id="adminUser"
          name="adminUser"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={initialUser ?? ""}
          maxLength={80}
          className="input-luxe"
          required
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? "login-error" : undefined}
        />
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
