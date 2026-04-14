"use client";

import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-[#e7dccb] bg-[#f9f4eb]/92 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="section-title">RSVP Admin</p>
            <p className="mt-1 text-sm text-zinc-600">Private event management workspace</p>
          </div>
          <form action={logoutAdminAction}>
            <button
              type="submit"
              className="btn-secondary"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </>
  );
}
