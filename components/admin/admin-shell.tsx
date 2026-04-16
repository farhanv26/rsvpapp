"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AdminAccountMenu } from "@/components/admin/admin-account-menu";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";

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
  const showActivityNav = user.role === "super_admin";
  const eventsActive = path.startsWith("/admin/events");
  const usersActive = path.startsWith("/admin/users");
  const activityActive = path.startsWith("/admin/activity");
  useEffect(() => {
    const storageKey = "rsvp_admin_user_mru_v1";
    try {
      const raw = localStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [user.name, ...current.filter((n) => n !== user.name)].slice(0, 12);
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // no-op
    }
  }, [user.name]);
  const pageContext = (() => {
    if (path.startsWith("/admin/users")) return "Users";
    if (path.startsWith("/admin/activity")) return "Activity";
    if (path.startsWith("/admin/events/new")) return "New Event";
    if (path.includes("/report")) return "Report";
    if (path.includes("/edit")) return "Edit Event";
    if (path.startsWith("/admin/events/")) return "Event Dashboard";
    if (path.startsWith("/admin/events")) return "Events";
    return "Workspace";
  })();

  return (
    <>
      <div className="sticky top-0 z-50 overflow-visible border-b border-[#e7dccb] bg-[#f9f4eb]/92 px-3 py-3 backdrop-blur-md sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 overflow-visible md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 min-h-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="section-title">RSVP Admin</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm text-zinc-600">Private event management workspace</p>
                  <span className="hidden h-1 w-1 rounded-full bg-zinc-300 sm:inline-block" />
                  <span className="inline-flex rounded-full border border-[#e2d4bf] bg-white/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                    {pageContext}
                  </span>
                </div>
              </div>
              <nav className="flex flex-wrap items-center gap-1.5" aria-label="Admin">
                <Link
                  href="/admin/events"
                  className={
                    eventsActive
                      ? "rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-[#e2d4bf]"
                      : "rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-white/60 hover:text-zinc-900"
                  }
                >
                  Events
                </Link>
                {showUsersNav ? (
                  <Link
                    href="/admin/users"
                    className={
                      usersActive
                        ? "rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-[#e2d4bf]"
                        : "rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-white/60 hover:text-zinc-900"
                    }
                  >
                    Users
                  </Link>
                ) : null}
                {showActivityNav ? (
                  <Link
                    href="/admin/activity"
                    className={
                      activityActive
                        ? "rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-[#e2d4bf]"
                        : "rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-white/60 hover:text-zinc-900"
                    }
                  >
                    Activity
                  </Link>
                ) : null}
              </nav>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <AdminNotificationBell />
            <AdminAccountMenu user={user} />
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
