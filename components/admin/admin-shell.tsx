"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminAccountMenu } from "@/components/admin/admin-account-menu";

type ShellUser = {
  name: string;
  role: string;
};

export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser;
}) {
  const path = usePathname();
  if (path === "/admin/login") {
    return <>{children}</>;
  }

  const showUsersNav = user.role === "super_admin";
  const eventsActive = path.startsWith("/admin/events");
  const usersActive = path.startsWith("/admin/users");

  return (
    <>
      <div className="sticky top-0 z-50 overflow-visible border-b border-[#e7dccb] bg-[#f9f4eb]/92 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 overflow-visible">
          <div className="min-w-0 min-h-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div>
                <p className="section-title">RSVP Admin</p>
                <p className="mt-1 text-sm text-zinc-600">Private event management workspace</p>
              </div>
              <nav className="flex flex-wrap items-center gap-2" aria-label="Admin">
                <Link
                  href="/admin/events"
                  className={
                    eventsActive
                      ? "rounded-full bg-white/90 px-3.5 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-[#e2d4bf]"
                      : "rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-white/60 hover:text-zinc-900"
                  }
                >
                  Events
                </Link>
                {showUsersNav ? (
                  <Link
                    href="/admin/users"
                    className={
                      usersActive
                        ? "rounded-full bg-white/90 px-3.5 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-[#e2d4bf]"
                        : "rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-white/60 hover:text-zinc-900"
                    }
                  >
                    Users
                  </Link>
                ) : null}
              </nav>
            </div>
          </div>
          <AdminAccountMenu user={user} />
        </div>
      </div>
      {children}
    </>
  );
}
