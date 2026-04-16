"use client";

import { useEffect, useRef } from "react";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { formatAdminRoleLabel } from "@/lib/admin-roles";

type AdminUserChip = {
  name: string;
  role: string;
};

/**
 * Account menu uses native <details>/<summary> for open/close so it stays reliable
 * with React Compiler and doesn’t depend on portal + useState timing.
 */
export function AdminAccountMenu({ user }: { user: AdminUserChip }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;

    const onDocPointerDown = (e: PointerEvent) => {
      if (!details.open) return;
      const target = e.target as Node;
      if (details.contains(target)) return;
      details.open = false;
    };

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !details.open) return;
      details.open = false;
    };

    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative shrink-0">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#e2d4bf] bg-white/90 px-2 py-1.5 pr-2.5 text-left shadow-sm transition hover:border-[#d4c4a8] hover:bg-white active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a66b]/40 [&::-webkit-details-marker]:hidden [&::marker]:hidden"
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#c9a66b] to-[#a67c52] text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="max-w-[120px] truncate text-sm font-semibold text-zinc-900 sm:max-w-[180px]">{user.name}</span>
      </summary>

      <div
        className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-72 max-w-[min(18rem,calc(100vw-1rem))] rounded-2xl border border-[#e7dccb] bg-[#fffcf6] p-4 shadow-lg ring-1 ring-black/5"
        role="menu"
        aria-label="Account menu"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#c9a66b] to-[#a67c52] text-lg font-semibold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-sm font-semibold text-zinc-900">{user.name}</p>
            <p className="mt-1 inline-flex rounded-full border border-[#e7dccb] bg-[#fbf8f2] px-2 py-0.5 text-xs text-zinc-600">
              {formatAdminRoleLabel(user.role)}
            </p>
          </div>
        </div>
        <div className="my-4 border-t border-[#ebe4d6]" />
        <form action={logoutAdminAction}>
          <button type="submit" className="btn-secondary w-full justify-center text-sm font-medium" role="menuitem">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
