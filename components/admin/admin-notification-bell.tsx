"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Menu } from "@/components/admin/ui/menu";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  entityType: string;
  entityId: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
};

export function AdminNotificationBell({ placement = "bottom-end" }: { placement?: "bottom-end" | "bottom-start" }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadNotifications() {
    try {
      const res = await fetch("/admin/api/notifications?take=30", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationItem[]; unreadCount: number };
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 7000);
    return () => clearInterval(interval);
  }, []);

  async function markAllAsRead() {
    await fetch("/admin/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }

  const hasUnread = unreadCount > 0;

  const mapped = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        href: (() => {
          if (item.entityType === "User") return "/admin/users";
          if (item.type === "EVENT_DELETED") return "/admin/events";
          if (item.eventId && (item.entityType === "Guest" || item.entityType === "RSVP")) {
            return `/admin/events/${item.eventId}`;
          }
          if (item.entityType === "Event") return `/admin/events/${item.entityId}`;
          return "/admin/events";
        })(),
      })),
    [items],
  );

  return (
    <Menu
      label={hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"}
      placement={placement}
      summaryClassName="icon-btn relative"
      panelClassName="w-[min(22rem,calc(100vw-1.5rem))]"
      trigger={
        <>
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {hasUnread ? (
            <span className="absolute right-1 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-semibold leading-none text-white sm:right-0 sm:top-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 px-2.5 py-2">
        <p className="text-sm font-semibold">Notifications</p>
        {hasUnread ? (
          <button type="button" className="text-link text-xs" onClick={markAllAsRead}>
            Mark all read
          </button>
        ) : null}
      </div>
      <div className="max-h-[min(26rem,calc(100dvh-8rem))] overflow-auto">
        {loading ? (
          <p className="px-2.5 py-4 text-sm text-[var(--muted-text)]">Loading…</p>
        ) : mapped.length === 0 ? (
          <p className="px-2.5 py-4 text-sm text-[var(--muted-text)]">Nothing new.</p>
        ) : (
          mapped.map((item) => (
            <button
              key={item.id}
              type="button"
              data-menu-close
              className="flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-muted)]"
              onClick={async () => {
                if (!item.read) {
                  await fetch("/admin/api/notifications/read", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id: item.id }),
                    keepalive: true,
                  });
                  setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
                  setUnreadCount((current) => Math.max(0, current - 1));
                }
                router.push(item.href);
              }}
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-[var(--accent)]"}`} aria-hidden />
              <span className="min-w-0">
                <span className={`block text-sm leading-5 ${item.read ? "text-[var(--muted-text)]" : "font-medium"}`}>
                  {item.title}
                  {!item.read ? <span className="sr-only"> (unread)</span> : null}
                </span>
                {item.description ? <span className="mt-0.5 block break-words text-xs text-[var(--muted-text)]">{item.description}</span> : null}
                <span className="mt-0.5 block text-xs text-[var(--muted-text)]">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </Menu>
  );
}
