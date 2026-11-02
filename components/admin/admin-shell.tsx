"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Activity, CalendarDays, Ellipsis, House, Settings, ShieldCheck, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import { AdminAccountMenu } from "@/components/admin/admin-account-menu";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { WeddingSwitcher, type WeddingSwitcherOption } from "@/components/admin/wedding-switcher";
import { Menu } from "@/components/admin/ui/menu";

type ShellUser = {
  name: string;
  role: string;
};

type NavItem = { href: string; label: string; icon: LucideIcon };

const PLANNING_NAV: NavItem[] = [
  { href: "/admin/overview", label: "Overview", icon: House },
  { href: "/admin/guests", label: "Guests", icon: Users },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/budget", label: "Budget", icon: Wallet },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const PLATFORM_NAV: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: ShieldCheck },
  { href: "/admin/activity", label: "Activity", icon: Activity },
];

/** Phone tab bar: four destinations plus “More”, per the five-item limit. */
const MOBILE_TABS = PLANNING_NAV.slice(0, 4);
const MOBILE_MORE = PLANNING_NAV.slice(4);

export function AdminShell({
  children,
  user,
  switcher,
}: {
  children: React.ReactNode;
  user: ShellUser;
  switcher: { value: string; options: WeddingSwitcherOption[] };
}) {
  const path = usePathname();

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

  if (path === "/admin/login") {
    return <>{children}</>;
  }

  const isPlatformAdmin = user.role === "super_admin";
  const isActive = (href: string) =>
    path === href || path.startsWith(`${href}/`) || (href === "/admin/settings" && path.startsWith("/admin/weddings"));
  const moreItems = [...MOBILE_MORE, ...(isPlatformAdmin ? PLATFORM_NAV : [])];
  const moreActive = moreItems.some((i) => isActive(i.href));
  const returnTo = path.startsWith("/admin/") ? path : "/admin/overview";

  const switcherEl =
    switcher.options.length > 0 ? (
      <WeddingSwitcher value={switcher.value} options={switcher.options} returnTo={returnTo} />
    ) : (
      <Link href="/admin/weddings" className="text-link text-sm">
        Create your wedding
      </Link>
    );

  return (
    <div className="lg:pl-60">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--border-soft)] bg-[var(--surface)] lg:flex">
        <div className="flex h-14 items-center justify-between gap-2 pl-5 pr-3">
          <Link href="/admin/overview" className="text-sm font-semibold tracking-tight">
            Wedding planner
          </Link>
          <AdminNotificationBell placement="bottom-start" />
        </div>
        <div className="px-3">{switcherEl}</div>
        <nav aria-label="Planning" className="mt-4 flex flex-col gap-0.5 px-3">
          {PLANNING_NAV.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        {isPlatformAdmin ? (
          <div className="mt-6 px-3">
            <p className="px-2.5 pb-1 text-xs font-medium text-[var(--muted-text)]">Platform admin</p>
            <nav aria-label="Platform admin" className="flex flex-col gap-0.5">
              {PLATFORM_NAV.map((item) => (
                <SideLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </nav>
          </div>
        ) : null}
        <div className="mt-auto border-t border-[var(--border-soft)] p-2">
          <AdminAccountMenu user={user} placement="top-start" showName />
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-[var(--border-soft)] bg-[var(--background)]/95 px-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">{switcherEl}</div>
        <AdminNotificationBell />
        <AdminAccountMenu user={user} />
      </header>

      <div id="main-content">{children}</div>

      {/* Phone tab bar */}
      <nav
        aria-label="Planning"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border-soft)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {MOBILE_TABS.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <Menu
          label="More"
          placement="top-end"
          className="flex"
          panelClassName="w-56"
          summaryClassName={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            moreActive ? "text-[var(--foreground)]" : "text-[var(--muted-text)]"
          }`}
          trigger={
            <>
              <Ellipsis className="h-5 w-5" aria-hidden />
              More
            </>
          }
        >
          {MOBILE_MORE.map((item) => (
            <MenuLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          {isPlatformAdmin ? (
            <>
              <div className="my-1 h-px bg-[var(--border-soft)]" role="separator" />
              <p className="px-2.5 py-1 text-xs font-medium text-[var(--muted-text)]">Platform admin</p>
              {PLATFORM_NAV.map((item) => (
                <MenuLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </>
          ) : null}
        </Menu>
      </nav>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
        active ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]" : "text-[var(--muted-text)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : ""}`} aria-hidden />
      {item.label}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
        active ? "text-[var(--foreground)]" : "text-[var(--muted-text)]"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-[var(--accent)]" : ""}`} aria-hidden />
      {item.label}
    </Link>
  );
}

function MenuLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-menu-close
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-[var(--surface-muted)] ${active ? "font-medium" : ""}`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-[var(--accent)]" : "text-[var(--muted-text)]"}`} aria-hidden />
      {item.label}
    </Link>
  );
}
