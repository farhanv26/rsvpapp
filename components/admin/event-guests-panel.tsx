"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { deleteGuestAction, updateGuestAction } from "@/app/admin/events/actions";

export type GuestPanelGuest = {
  id: string;
  guestName: string;
  maxGuests: number;
  token: string;
  attending: boolean | null;
  attendingCount: number | null;
  respondedAt: string | null;
  group: string | null;
  notes: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
};

type Props = {
  eventId: string;
  eventTitle: string;
  guests: GuestPanelGuest[];
  /** Public origin without trailing slash; empty means relative /rsvp/... links */
  siteUrl: string;
};

function statusOf(g: GuestPanelGuest): "pending" | "attending" | "declined" {
  if (!g.respondedAt) {
    return "pending";
  }
  if (g.attending === true) {
    return "attending";
  }
  return "declined";
}

function formatResponded(iso: string | null) {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const filterTabs: { id: "all" | "pending" | "attending" | "declined"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "attending", label: "Attending" },
  { id: "declined", label: "Declined" },
];

function guestRsvpUrl(siteUrl: string, token: string) {
  const path = `/rsvp/${token}`;
  if (!siteUrl) {
    return path;
  }
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

function buildInviteMessage(guestName: string, link: string, eventTitle: string) {
  return `Hi ${guestName},

We are so happy to invite you to celebrate our ${eventTitle} with us.
Please RSVP using your private link:
${link}

With love,
Farhan & Rafiya`;
}

function waShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function EventGuestsPanel({ eventId, eventTitle, guests, siteUrl }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filterTabs)[number]["id"]>("all");
  const [sort, setSort] = useState<"nameAsc" | "nameDesc" | "recent" | "responded">("recent");
  const [copiedMessageGuestId, setCopiedMessageGuestId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...guests];
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((g) => {
        const hay = [g.guestName, g.group, g.notes, g.phone, g.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }
    if (filter !== "all") {
      list = list.filter((g) => statusOf(g) === filter);
    }
    list.sort((a, b) => {
      switch (sort) {
        case "nameAsc":
          return a.guestName.localeCompare(b.guestName);
        case "nameDesc":
          return b.guestName.localeCompare(a.guestName);
        case "responded": {
          const ta = a.respondedAt ? new Date(a.respondedAt).getTime() : 0;
          const tb = b.respondedAt ? new Date(b.respondedAt).getTime() : 0;
          return tb - ta;
        }
        case "recent":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return list;
  }, [guests, q, filter, sort]);

  return (
    <div className="app-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Guests</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {guests.length} famil{guests.length === 1 ? "y" : "ies"} · Search & filter below
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center sm:justify-end">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, group, notes…"
            className="input-luxe mt-0 py-2.5 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-2xl border border-[#dccfbb] bg-white px-3 py-2.5 text-sm font-medium text-zinc-800"
            aria-label="Sort guests"
          >
            <option value="recent">Newest added</option>
            <option value="nameAsc">Name A–Z</option>
            <option value="nameDesc">Name Z–A</option>
            <option value="responded">Recently responded</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === t.id ? "bg-[#3f2f1f] text-white" : "bg-[#f5efe4] text-zinc-700 hover:bg-[#ede3d1]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-1 text-sm text-zinc-500">
        Showing {filtered.length} of {guests.length}
      </div>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <p className="app-card-muted border border-dashed px-4 py-8 text-center text-sm text-zinc-600">
            No guests match your filters.
          </p>
        ) : (
          filtered.map((guest) => {
            const link = guestRsvpUrl(siteUrl, guest.token);
            const inviteMessage = buildInviteMessage(guest.guestName, link, eventTitle);
            const st = statusOf(guest);
            return (
              <article
                key={guest.id}
                className="app-card rounded-2xl border-[#e4d8c4] bg-gradient-to-b from-white to-[#fcf8f1] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-900">{guest.guestName}</h3>
                      {guest.group ? (
                        <span className="badge-soft">
                          {guest.group}
                        </span>
                      ) : null}
                      <span
                        className={`${
                          st === "pending"
                            ? "badge-neutral"
                            : st === "attending"
                              ? "badge-success"
                              : "badge-danger"
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      Max {guest.maxGuests}
                      {st === "attending" && guest.attendingCount != null
                        ? ` · ${guest.attendingCount} attending`
                        : ""}
                      <span className="text-zinc-500"> · Responded {formatResponded(guest.respondedAt)}</span>
                    </p>
                    {(guest.phone || guest.email || guest.notes) ? (
                      <p className="mt-2 text-xs text-zinc-500 break-words">
                        {[guest.phone, guest.email].filter(Boolean).join(" · ")}
                        {guest.notes ? ` · ${guest.notes}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <CopyLinkButton value={link} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteMessage);
                          setCopiedMessageGuestId(guest.id);
                          setTimeout(() => {
                            setCopiedMessageGuestId((current) => (current === guest.id ? null : current));
                          }, 1800);
                        } catch {
                          setCopiedMessageGuestId(null);
                        }
                      }}
                      className={`btn-secondary px-3.5 py-2 text-sm font-semibold shadow-sm ${
                        copiedMessageGuestId === guest.id
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {copiedMessageGuestId === guest.id ? "Copied message!" : "Copy invite message"}
                    </button>
                    <a
                      href={waShareUrl(inviteMessage)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                    >
                      WhatsApp
                    </a>
                    <form action={deleteGuestAction}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="guestId" value={guest.id} />
                      <button
                        type="submit"
                        className="btn-secondary border-red-200 bg-white text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-zinc-100 bg-white px-3 py-2 font-mono text-[11px] text-zinc-600 break-all sm:text-xs">
                  {link}
                </div>

                <form action={updateGuestAction} className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="guestId" value={guest.id} />
                  <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
                    Name
                    <input
                      type="text"
                      name="guestName"
                      defaultValue={guest.guestName}
                      className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-600">
                    Max guests
                    <input
                      type="number"
                      name="maxGuests"
                      min={1}
                      defaultValue={guest.maxGuests}
                      className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-600">
                    Group
                    <input
                      type="text"
                      name="group"
                      defaultValue={guest.group ?? ""}
                      className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-600">
                    Phone
                    <input
                      type="text"
                      name="phone"
                      defaultValue={guest.phone ?? ""}
                      className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-600">
                    Email
                    <input
                      type="email"
                      name="email"
                      defaultValue={guest.email ?? ""}
                      className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-600 sm:col-span-2 lg:col-span-3">
                    Notes
                    <input
                      type="text"
                      name="notes"
                      defaultValue={guest.notes ?? ""}
                      className="mt-1 w-full rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <button type="submit" className="btn-secondary">
                      Save changes
                    </button>
                  </div>
                </form>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
