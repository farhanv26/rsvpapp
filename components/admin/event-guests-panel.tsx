"use client";

import { useMemo, useState } from "react";
import {
  bulkDeleteGuestsAction,
  deleteGuestAction,
  logBulkWhatsappPreparedAction,
  logGuestWhatsappPreparedAction,
  sendBulkGuestInviteEmailsAction,
  sendGuestInviteEmailAction,
  updateGuestAction,
} from "@/app/admin/events/actions";
import { buildGuestWhatsAppInviteMessage, getWhatsAppShareUrl } from "@/lib/whatsapp";

export type GuestPanelGuest = {
  id: string;
  guestName: string;
  greeting: string;
  maxGuests: number;
  token: string;
  attending: boolean | null;
  attendingCount: number | null;
  respondedAt: string | null;
  group: string | null;
  notes: string | null;
  hostMessage: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  eventId: string;
  eventTitle: string;
  guests: GuestPanelGuest[];
  siteUrl: string;
};

function statusOf(g: GuestPanelGuest): "pending" | "attending" | "declined" {
  if (!g.respondedAt) return "pending";
  if (g.attending === true) return "attending";
  return "declined";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusLabel(status: ReturnType<typeof statusOf>) {
  if (status === "pending") return "Pending";
  if (status === "attending") return "Attending";
  return "Declined";
}

function statusBadgeClass(status: ReturnType<typeof statusOf>) {
  if (status === "pending") return "badge-neutral";
  if (status === "attending") return "badge-success";
  return "badge-danger";
}

const filterTabs: { id: "all" | "pending" | "attending" | "declined"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "attending", label: "Attending" },
  { id: "declined", label: "Declined" },
];

function guestRsvpUrl(siteUrl: string, token: string) {
  const path = `/rsvp/${token}`;
  if (!siteUrl) return path;
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.11 17.44c-.26-.13-1.51-.75-1.75-.83-.23-.09-.4-.13-.57.13-.17.26-.66.83-.81 1-.15.17-.3.2-.56.07-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.29-1.54-1.44-1.8-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.57-1.36-.78-1.86-.21-.5-.42-.43-.57-.43l-.48-.01c-.17 0-.45.06-.68.32-.23.26-.9.88-.9 2.14 0 1.26.92 2.48 1.05 2.65.13.17 1.8 2.75 4.37 3.86.61.26 1.08.42 1.45.54.61.19 1.17.16 1.61.1.49-.07 1.51-.62 1.72-1.22.21-.6.21-1.11.15-1.22-.06-.11-.23-.17-.49-.3Z"
      />
      <path
        fill="currentColor"
        d="M16.02 5.33c-5.88 0-10.67 4.78-10.67 10.67 0 1.89.5 3.74 1.45 5.37L5.33 26.7l5.46-1.43c1.57.85 3.33 1.3 5.22 1.3 5.88 0 10.67-4.78 10.67-10.67S21.9 5.33 16.02 5.33Zm0 19.35c-1.68 0-3.33-.45-4.77-1.3l-.34-.2-3.24.85.86-3.16-.22-.33c-.92-1.43-1.41-3.08-1.41-4.78 0-4.95 4.03-8.98 8.98-8.98S25 10.81 25 15.76s-4.03 8.92-8.98 8.92Z"
      />
    </svg>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function EventGuestsPanel({ eventId, eventTitle, guests, siteUrl }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filterTabs)[number]["id"]>("all");
  const [sort, setSort] = useState<"nameAsc" | "status" | "maxGuestsDesc" | "updatedDesc">("updatedDesc");
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedMessageGuestId, setCopiedMessageGuestId] = useState<string | null>(null);
  const [copiedBulkLinks, setCopiedBulkLinks] = useState(false);
  const [copiedBulkInvites, setCopiedBulkInvites] = useState(false);
  const [emailSendingGuestId, setEmailSendingGuestId] = useState<string | null>(null);
  const [emailSentGuestId, setEmailSentGuestId] = useState<string | null>(null);
  const [bulkEmailStatus, setBulkEmailStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...guests];
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((g) => {
        const hay = [g.guestName, g.greeting, g.group, g.notes, g.phone, g.email, statusLabel(statusOf(g))]
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
        case "status": {
          const order: Record<ReturnType<typeof statusOf>, number> = {
            attending: 0,
            pending: 1,
            declined: 2,
          };
          const statusDiff = order[statusOf(a)] - order[statusOf(b)];
          if (statusDiff !== 0) return statusDiff;
          return a.guestName.localeCompare(b.guestName);
        }
        case "maxGuestsDesc":
          return b.maxGuests - a.maxGuests;
        case "updatedDesc":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return list;
  }, [guests, q, filter, sort]);

  const selectedGuests = useMemo(
    () => filtered.filter((guest) => selectedIds.has(guest.id)),
    [filtered, selectedIds],
  );
  const selectedCount = selectedGuests.length;
  const selectedWithEmail = useMemo(
    () => selectedGuests.filter((guest) => Boolean(guest.email?.trim())),
    [selectedGuests],
  );
  const hasGuests = guests.length > 0;
  const trueEmpty = !hasGuests;
  const filteredEmpty = hasGuests && filtered.length === 0;
  const allVisibleSelected = filtered.length > 0 && filtered.every((guest) => selectedIds.has(guest.id));

  function clearFilters() {
    setQ("");
    setFilter("all");
    setSort("updatedDesc");
  }

  function toggleAllVisible() {
    setSelectedIds(() => {
      if (allVisibleSelected) return new Set();
      const next = new Set<string>();
      filtered.forEach((guest) => next.add(guest.id));
      return next;
    });
  }

  function toggleGuestSelection(guestId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(guestId);
      else next.delete(guestId);
      return next;
    });
  }

  function exportGuests(mode: "all" | "filtered" | "selected") {
    const source =
      mode === "all" ? guests : mode === "filtered" ? filtered : filtered.filter((g) => selectedIds.has(g.id));

    const rows = [
      [
        "Guest Name",
        "Greeting",
        "Group",
        "Max Guests",
        "RSVP Status",
        "Attending Count",
        "Response Time",
        "Message to host",
        "Email",
        "Phone",
        "Notes",
      ],
      ...source.map((guest) => {
        return [
          guest.guestName,
          guest.greeting || "Assalamu Alaikum",
          guest.group ?? "",
          String(guest.maxGuests),
          statusLabel(statusOf(guest)),
          String(guest.attendingCount ?? 0),
          formatDate(guest.respondedAt),
          guest.hostMessage ?? "",
          guest.email ?? "",
          guest.phone ?? "",
          guest.notes ?? "",
        ];
      }),
    ];

    const suffix = mode === "all" ? "all" : mode === "filtered" ? "filtered" : "selected";
    downloadCsv(`guests-${suffix}.csv`, rows);
  }

  async function copyBulkLinks() {
    if (selectedCount === 0) return;
    const lines = selectedGuests.map((guest) => `${guest.guestName}: ${guestRsvpUrl(siteUrl, guest.token)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedBulkLinks(true);
      setTimeout(() => setCopiedBulkLinks(false), 1800);
    } catch {
      setCopiedBulkLinks(false);
    }
  }

  async function copyBulkWhatsAppInvites() {
    if (selectedCount === 0) return;
    const bundles = selectedGuests.map((guest) => {
      const link = guestRsvpUrl(siteUrl, guest.token);
      const message = buildGuestWhatsAppInviteMessage({
        greeting: guest.greeting,
        guestName: guest.guestName,
        eventTitle,
        rsvpLink: link,
      });
      return `${guest.guestName}\n${message}`;
    });
    try {
      await navigator.clipboard.writeText(bundles.join("\n\n---\n\n"));
      setCopiedBulkInvites(true);
      setTimeout(() => setCopiedBulkInvites(false), 1800);
      void logBulkWhatsappPreparedAction(eventId, selectedGuests.map((guest) => guest.id));
    } catch {
      setCopiedBulkInvites(false);
    }
  }

  async function sendBulkEmailInvites() {
    if (selectedWithEmail.length === 0) return;
    setBulkEmailStatus("Sending...");
    try {
      const result = await sendBulkGuestInviteEmailsAction(
        eventId,
        selectedWithEmail.map((guest) => guest.id),
      );
      setBulkEmailStatus(
        `Sent ${result.sent}. Skipped ${result.skippedMissingEmail}. Failed ${result.failed}.`,
      );
    } catch {
      setBulkEmailStatus("Could not send bulk email invites right now.");
    }
  }

  return (
    <div className="app-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Guests</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {guests.length} famil{guests.length === 1 ? "y" : "ies"} · Realtime search, sort, and bulk actions
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:max-w-4xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guest name, group, notes, status..."
            className="input-luxe mt-0 py-2.5 text-sm sm:min-w-72"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-2xl border border-[#dccfbb] bg-white px-3 py-2.5 text-sm font-medium text-zinc-800"
            aria-label="Sort guests"
          >
            <option value="updatedDesc">Last updated (latest)</option>
            <option value="nameAsc">Name (A-Z)</option>
            <option value="status">RSVP status</option>
            <option value="maxGuestsDesc">Max guests (high to low)</option>
          </select>
          <button type="button" className="btn-secondary" onClick={clearFilters}>
            Reset
          </button>
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

      <div className="mt-4 text-sm text-zinc-500">Showing {filtered.length} of {guests.length}</div>

      {selectedCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9ccb6] bg-[#f8f1e5] px-4 py-3">
          <p className="text-sm font-medium text-zinc-800">{selectedCount} selected</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={copyBulkLinks}>
              {copiedBulkLinks ? "Copied links!" : "Copy links"}
            </button>
            <button type="button" className="btn-secondary" onClick={copyBulkWhatsAppInvites}>
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                {copiedBulkInvites ? "Copied WhatsApp invites!" : "Copy WhatsApp invites"}
              </span>
            </button>
            <button type="button" className="btn-secondary" onClick={() => exportGuests("selected")}>
              Export selected CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={sendBulkEmailInvites}
              disabled={selectedWithEmail.length === 0}
              title={selectedWithEmail.length === 0 ? "No selected guests have an email address" : undefined}
            >
              Send email invites ({selectedWithEmail.length})
            </button>
            <form
              action={bulkDeleteGuestsAction}
              onSubmit={(e) => {
                if (!confirm(`Delete ${selectedCount} selected guest(s)? This cannot be undone.`)) {
                  e.preventDefault();
                  return;
                }
                setSelectedIds(new Set());
              }}
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="guestIds" value={[...selectedIds].join(",")} />
              <button type="submit" className="btn-secondary border-red-200 bg-white text-red-600 hover:bg-red-50">
                Delete selected
              </button>
            </form>
            <button type="button" className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </button>
          </div>
          {bulkEmailStatus ? <p className="w-full text-xs text-zinc-600">{bulkEmailStatus}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => exportGuests("all")}>
          Export all CSV
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const source = filtered;
            const rows = [
              [
                "Guest Name",
                "Greeting",
                "Token",
                "RSVP Link",
                "Group",
                "Max Guests",
                "Attending (true/false)",
                "Attending Count",
                "Responded At (ISO)",
                "Last Updated (ISO)",
                "Message to host",
                "Email",
                "Phone",
                "Notes",
              ],
              ...source.map((guest) => {
                const st = statusOf(guest);
                const link = guestRsvpUrl(siteUrl, guest.token);
                const attendingBool = st === "attending";
                return [
                  guest.guestName,
                  guest.greeting || "Assalamu Alaikum",
                  guest.token,
                  link,
                  guest.group ?? "",
                  String(guest.maxGuests),
                  String(attendingBool),
                  String(guest.attendingCount ?? 0),
                  guest.respondedAt ?? "",
                  guest.updatedAt,
                  guest.hostMessage ?? "",
                  guest.email ?? "",
                  guest.phone ?? "",
                  guest.notes ?? "",
                ];
              }),
            ];
            downloadCsv("rsvp-dataset.csv", rows);
          }}
        >
          Export RSVP dataset
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const confirmed = filtered.filter((g) => statusOf(g) === "attending");
            const rows = [
              [
                "Guest Name",
                "Greeting",
                "Group",
                "Max Guests",
                "RSVP Status",
                "Attending Count",
                "Response Time",
                "Message to host",
                "Email",
                "Phone",
                "Notes",
              ],
              ...confirmed.map((guest) => [
                guest.guestName,
                guest.greeting || "Assalamu Alaikum",
                guest.group ?? "",
                String(guest.maxGuests),
                statusLabel(statusOf(guest)),
                String(guest.attendingCount ?? 0),
                formatDate(guest.respondedAt),
                guest.hostMessage ?? "",
                guest.email ?? "",
                guest.phone ?? "",
                guest.notes ?? "",
              ]),
            ];
            downloadCsv("guests-confirmed-attendees.csv", rows);
          }}
        >
          Export confirmed attendees
        </button>
        <button type="button" className="btn-secondary" onClick={() => exportGuests("filtered")}>
          Export filtered CSV
        </button>
      </div>

      <div className="mt-4">
        {trueEmpty ? (
          <p className="app-card-muted border border-dashed px-4 py-8 text-center text-sm text-zinc-600">
            No guests have been added yet.
          </p>
        ) : filteredEmpty ? (
          <div className="app-card-muted border border-dashed px-4 py-8 text-center text-sm text-zinc-600">
            <p>No guests matched your search criteria.</p>
            <button type="button" onClick={clearFilters} className="btn-secondary mt-4">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#e7dccb]">
            <div className="max-h-[34rem] min-w-[1050px] overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#f7efe2]">
                  <tr className="border-b border-[#e1d5c3] text-xs uppercase tracking-[0.12em] text-zinc-600">
                    <th className="w-12 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible guests"
                      />
                    </th>
                    <th className="px-3 py-3">Guest Name</th>
                    <th className="px-3 py-3">Greeting</th>
                    <th className="px-3 py-3">Max Guests</th>
                    <th className="px-3 py-3">RSVP Status</th>
                    <th className="px-3 py-3">Attending Count</th>
                    <th className="px-3 py-3">Group / Tag</th>
                    <th className="px-3 py-3">Last Updated</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filtered.map((guest) => {
                    const link = guestRsvpUrl(siteUrl, guest.token);
                    const inviteMessage = buildGuestWhatsAppInviteMessage({
                      greeting: guest.greeting,
                      guestName: guest.guestName,
                      eventTitle,
                      rsvpLink: link,
                    });
                    const st = statusOf(guest);
                    const isEditing = editingGuestId === guest.id;

                    return (
                      <tr
                        key={guest.id}
                        className="border-b border-[#f0e7d9] text-sm text-zinc-700 transition hover:bg-[#fcf8f1]"
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(guest.id)}
                            onChange={(e) => toggleGuestSelection(guest.id, e.target.checked)}
                            aria-label={`Select ${guest.guestName}`}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-zinc-900">{guest.guestName}</p>
                          {(guest.phone || guest.email || guest.notes || guest.hostMessage) ? (
                            <p className="mt-1 max-w-xs text-xs text-zinc-500">
                              {[guest.phone, guest.email, guest.hostMessage ? `Message: ${guest.hostMessage}` : null, guest.notes]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-zinc-600">{guest.greeting || "Assalamu Alaikum"}</td>
                        <td className="px-3 py-3 align-top tabular-nums">{guest.maxGuests}</td>
                        <td className="px-3 py-3 align-top">
                          <span className={statusBadgeClass(st)}>{statusLabel(st)}</span>
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums">{guest.attendingCount ?? 0}</td>
                        <td className="px-3 py-3 align-top">
                          {guest.group ? <span className="badge-soft">{guest.group}</span> : <span className="text-zinc-400">-</span>}
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-zinc-600">{formatDate(guest.updatedAt)}</td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(link);
                                } catch {
                                  // no-op
                                }
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              Copy link
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(inviteMessage);
                                  setCopiedMessageGuestId(guest.id);
                                  void logGuestWhatsappPreparedAction(eventId, guest.id);
                                  setTimeout(() => {
                                    setCopiedMessageGuestId(null);
                                  }, 1800);
                                } catch {
                                  setCopiedMessageGuestId(null);
                                }
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              {copiedMessageGuestId === guest.id ? "Copied!" : "Copy invite"}
                            </button>
                            {guest.email ? (
                              <button
                                type="button"
                                className="btn-secondary px-3 py-1.5 text-xs"
                                disabled={emailSendingGuestId === guest.id}
                                onClick={async () => {
                                  setEmailSendingGuestId(guest.id);
                                  setEmailSentGuestId(null);
                                  try {
                                    const result = await sendGuestInviteEmailAction(eventId, guest.id);
                                    if (result.ok && !result.skipped) {
                                      setEmailSentGuestId(guest.id);
                                      setTimeout(() => setEmailSentGuestId(null), 1800);
                                    }
                                  } finally {
                                    setEmailSendingGuestId(null);
                                  }
                                }}
                              >
                                {emailSendingGuestId === guest.id
                                  ? "Sending..."
                                  : emailSentGuestId === guest.id
                                    ? "Email sent!"
                                    : "Send email"}
                              </button>
                            ) : null}
                            <a
                              href={getWhatsAppShareUrl(inviteMessage)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              aria-label="Send via WhatsApp"
                              title="Send via WhatsApp"
                              onClick={() => {
                                void logGuestWhatsappPreparedAction(eventId, guest.id);
                              }}
                            >
                              <span className="inline-flex items-center gap-2">
                                <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </span>
                            </a>
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              onClick={() => setEditingGuestId((curr) => (curr === guest.id ? null : guest.id))}
                            >
                              {isEditing ? "Close edit" : "Edit"}
                            </button>
                            <form action={deleteGuestAction}>
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="guestId" value={guest.id} />
                              <button
                                type="submit"
                                className="btn-secondary border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                          {isEditing ? (
                            <form action={updateGuestAction} className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-2">
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="guestId" value={guest.id} />
                              <input
                                type="text"
                                name="guestName"
                                defaultValue={guest.guestName}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                required
                                placeholder="Guest name"
                              />
                              <input
                                type="number"
                                name="maxGuests"
                                min={1}
                                defaultValue={guest.maxGuests}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                required
                                placeholder="Max guests"
                              />
                              <input
                                type="text"
                                name="greeting"
                                defaultValue={guest.greeting || "Assalamu Alaikum"}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                placeholder="Greeting"
                              />
                              <input
                                type="text"
                                name="group"
                                defaultValue={guest.group ?? ""}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                placeholder="Group"
                              />
                              <input
                                type="text"
                                name="phone"
                                defaultValue={guest.phone ?? ""}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                placeholder="Phone"
                              />
                              <input
                                type="email"
                                name="email"
                                defaultValue={guest.email ?? ""}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                placeholder="Email"
                              />
                              <input
                                type="text"
                                name="notes"
                                defaultValue={guest.notes ?? ""}
                                className="rounded-xl border border-[#dccfbb] bg-white px-3 py-2 text-xs"
                                placeholder="Notes"
                              />
                              <div className="sm:col-span-2">
                                <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                                  Save changes
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
