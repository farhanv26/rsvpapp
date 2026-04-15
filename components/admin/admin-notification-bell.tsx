"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export function AdminNotificationBell() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
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
        href:
          item.eventId && (item.entityType === "Guest" || item.entityType === "RSVP")
            ? `/admin/events/${item.eventId}`
            : item.entityType === "Event"
              ? `/admin/events/${item.entityId}`
              : "/admin/events",
      })),
    [items],
  );

  return (
    <details ref={detailsRef} className="relative shrink-0">
      <summary
        className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[#e2d4bf] bg-white/90 text-zinc-700 shadow-sm transition hover:border-[#d4c4a8] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a66b]/40 [&::-webkit-details-marker]:hidden [&::marker]:hidden"
        aria-label="Notifications"
      >
        <BellIcon />
        {hasUnread ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-[22rem] max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#e7dccb] bg-[#fffcf6] p-3 shadow-lg ring-1 ring-black/5">
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-sm font-semibold text-zinc-900">Notifications</p>
          {hasUnread ? (
            <button type="button" className="text-xs font-medium text-zinc-600 hover:text-zinc-900" onClick={markAllAsRead}>
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="mt-2 max-h-[26rem] space-y-1 overflow-auto">
          {loading ? (
            <p className="px-2 py-4 text-sm text-zinc-500">Loading notifications...</p>
          ) : mapped.length === 0 ? (
            <p className="px-2 py-4 text-sm text-zinc-500">No notifications yet.</p>
          ) : (
            mapped.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  item.read
                    ? "border-[#efe8dc] bg-[#fffdfa] hover:bg-white"
                    : "border-[#e3d6bf] bg-[#fff8ec] hover:bg-[#fff4df]"
                }`}
                onClick={async () => {
                  if (!item.read) {
                    await fetch("/admin/api/notifications/read", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ id: item.id }),
                      keepalive: true,
                    });
                    setItems((current) =>
                      current.map((row) => (row.id === item.id ? { ...row, read: true } : row)),
                    );
                    setUnreadCount((current) => Math.max(0, current - 1));
                  }
                  detailsRef.current && (detailsRef.current.open = false);
                  router.push(item.href);
                }}
              >
                <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-xs text-zinc-600">{item.description}</p> : null}
                <p className="mt-1 text-[11px] text-zinc-500">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(item.createdAt),
                  )}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </details>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a5 5 0 0 0-5 5v2.76c0 .77-.24 1.52-.69 2.15L5 15h14l-1.31-2.09a3.98 3.98 0 0 1-.69-2.15V8a5 5 0 0 0-5-5Zm0 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 12 21Z"
      />
    </svg>
  );
}
