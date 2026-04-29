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

  return (
    <>
      {/* ─── Top navigation bar ──────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-[#e7dccb]/80 bg-[#faf6ee]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5">

          {/* Brand + page context */}
          <div className="min-w-0 flex-1">
            <Link
              href="/admin/events"
              className="group inline-flex flex-col outline-none"
            >
              <span className="text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-zinc-400 transition group-hover:text-zinc-500">
                RSVP Admin
              </span>
              <span className="text-sm font-semibold text-zinc-800 transition group-hover:text-zinc-900">
                Event Management
              </span>
            </Link>
          </div>

          {/* Primary nav links */}
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Admin navigation">
            <NavLink href="/admin/events" active={eventsActive}>
              Events
            </NavLink>
            {showUsersNav && (
              <NavLink href="/admin/users" active={usersActive}>
                Users
              </NavLink>
            )}
            {showActivityNav && (
              <NavLink href="/admin/activity" active={activityActive}>
                Activity
              </NavLink>
            )}
          </nav>

          {/* Right side: bell + account */}
          <div className="flex items-center gap-1.5">
            <AdminNotificationBell />
            <AdminAccountMenu user={user} />
          </div>
        </div>

        {/* Mobile nav — shown below primary row on small screens */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
          <NavLink href="/admin/events" active={eventsActive}>
            Events
          </NavLink>
          {showUsersNav && (
            <NavLink href="/admin/users" active={usersActive}>
              Users
            </NavLink>
          )}
          {showActivityNav && (
            <NavLink href="/admin/activity" active={activityActive}>
              Activity
            </NavLink>
          )}
        </div>
      </div>

      {children}
    </>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-[#3f2f1f] text-white shadow-sm"
          : "text-zinc-600 hover:bg-[#f2ebe0] hover:text-zinc-900"
      }`}
    >
      {children}
    </Link>
  );
}
