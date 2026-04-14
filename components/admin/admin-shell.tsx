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
      <div className="sticky top-0 z-20 border-b border-amber-900/10 bg-[#faf8f3]/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl justify-end">
          <form action={logoutAdminAction}>
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
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
