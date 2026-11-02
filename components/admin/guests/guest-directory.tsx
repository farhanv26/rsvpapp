"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Ellipsis, Plus, Search, X } from "lucide-react";
import { bulkDeleteGuestsAction, markGuestsInvitedAction, markGuestsUninvitedAction } from "@/app/admin/events/actions";
import { GuestFormDialog, type GuestFormGuest } from "@/components/admin/guests/guest-form-dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/admin/ui/menu";
import { EmptyState, PageHeader } from "@/components/admin/planning-ui";

export type DirectoryEvent = { id: string; title: string; canAdd: boolean; allowance: { places: number; used: number } | null };
export type DirectoryAllowance = { eventId: string; eventTitle: string; memberName: string; places: number; used: number };
export type DirectoryCell = {
  guestId: string;
  status: "attending" | "declined" | "waiting" | "not_invited";
  attendingCount: number | null;
  places: number;
  canEdit: boolean;
  form: GuestFormGuest;
};
export type DirectoryHousehold = {
  key: string;
  name: string;
  group: string | null;
  contact: string;
  managers: string[];
  cells: Record<string, DirectoryCell | undefined>;
};

type Filters = { q: string; event: string; status: string; member: string };

const STATUS_FILTERS = [
  { value: "", label: "Any reply" },
  { value: "waiting", label: "No reply yet" },
  { value: "attending", label: "Attending" },
  { value: "declined", label: "Declined" },
  { value: "not_invited", label: "Not invited" },
];

export function CellStatus({ cell }: { cell: DirectoryCell | undefined }) {
  if (!cell) return <span className="text-[var(--muted-text)]" aria-label="Not on this event">—</span>;
  if (cell.status === "attending") return <span className="status status-success">Attending · {cell.attendingCount ?? 0}</span>;
  if (cell.status === "declined") return <span className="status status-muted">Declined</span>;
  if (cell.status === "waiting") return <span className="status status-warning">No reply</span>;
  return <span className="status status-muted">Not invited</span>;
}

export function GuestDirectory({
  events,
  members,
  rows,
  matchCount,
  totalHouseholds,
  totalPlaces,
  allowances,
  filters,
  page,
  pages,
  defaultGreeting,
}: {
  events: DirectoryEvent[];
  members: { id: string; name: string }[];
  rows: DirectoryHousehold[];
  matchCount: number;
  totalHouseholds: number;
  totalPlaces: number | null;
  allowances: DirectoryAllowance[];
  filters: Filters;
  page: number;
  pages: number;
  defaultGreeting: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navPending, startNav] = useTransition();
  const [actionPending, startAction] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEventId, setBulkEventId] = useState(filters.event);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ eventId: string; form: GuestFormGuest } | null>(null);
  const [adding, setAdding] = useState(false);
  const [formNonce, setFormNonce] = useState(0);
  const firstRender = useRef(true);

  const addableEvents = events.filter((e) => e.canAdd);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const filtered = Boolean(filters.q || filters.event || filters.status || filters.member);

  function navigate(patch: Partial<Filters> & { page?: string }) {
    const next = { ...filters, q, ...patch };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "page" && v === "1")) params.set(k, v);
    setSelected(new Set());
    startNav(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (q.trim() !== filters.q) navigate({ q: q.trim(), page: "1" });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on the search text only
  }, [q]);

  const selectedRows = rows.filter((r) => selected.has(r.key));
  const bulkEventOptions = events.filter((e) => selectedRows.some((r) => r.cells[e.id]));
  const matchingCount = (eventId: string) =>
    selectedRows.filter((r) => {
      const c = r.cells[eventId];
      return c && (!filters.status || c.status === filters.status);
    }).length;
  const suggestedBulkEvent = [...bulkEventOptions].sort((a, b) => matchingCount(b.id) - matchingCount(a.id))[0]?.id ?? "";
  const effectiveBulkEvent = bulkEventOptions.some((e) => e.id === bulkEventId) ? bulkEventId : suggestedBulkEvent;
  const bulkGuestIds = selectedRows.map((r) => r.cells[effectiveBulkEvent]).filter((c): c is DirectoryCell => Boolean(c?.canEdit)).map((c) => c.guestId);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.key));

  function toggle(key: string, on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function runBulk(kind: "invited" | "uninvited" | "remove") {
    const eventTitle = eventById.get(effectiveBulkEvent)?.title ?? "this event";
    const n = bulkGuestIds.length;
    if (n === 0) return;
    if (kind === "remove" && !confirm(`Remove ${n} ${n === 1 ? "household" : "households"} from ${eventTitle}? You can restore them from the event's guest list.`)) return;
    if (kind === "uninvited" && !confirm(`Mark ${n} ${n === 1 ? "household" : "households"} as not invited to ${eventTitle}? Replies already received stay on file.`)) return;
    startAction(async () => {
      if (kind === "invited") await markGuestsInvitedAction(effectiveBulkEvent, bulkGuestIds, "manual");
      if (kind === "uninvited") await markGuestsUninvitedAction(effectiveBulkEvent, bulkGuestIds);
      if (kind === "remove") {
        const fd = new FormData();
        fd.set("eventId", effectiveBulkEvent);
        fd.set("guestIds", bulkGuestIds.join(","));
        await bulkDeleteGuestsAction(fd);
      }
      setNotice(
        kind === "invited"
          ? `Marked ${n} as invited to ${eventTitle}.`
          : kind === "uninvited"
            ? `Marked ${n} as not invited to ${eventTitle}.`
            : `Removed ${n} from ${eventTitle}.`,
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  function openEdit(row: DirectoryHousehold, eventId?: string) {
    const id = eventId ?? (filters.event && row.cells[filters.event]?.canEdit ? filters.event : events.find((e) => row.cells[e.id]?.canEdit)?.id);
    const cell = id ? row.cells[id] : undefined;
    if (!id || !cell?.canEdit) return;
    setFormNonce((n) => n + 1);
    setEditing({ eventId: id, form: cell.form });
  }

  const meta =
    totalHouseholds === 0
      ? null
      : `${totalHouseholds} ${totalHouseholds === 1 ? "household" : "households"}${totalPlaces !== null ? ` · ${totalPlaces} places` : ""}${
          events.length > 1 ? ` across ${events.length} events` : ""
        }`;

  return (
    <>
      <PageHeader
        title="Guests"
        meta={meta}
        actions={
          addableEvents.length > 0 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFormNonce((n) => n + 1);
                setAdding(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add household
            </button>
          ) : null
        }
      />

      {allowances.length > 0 ? (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Guest allowances">
          {allowances.map((a) => {
            const over = a.used > a.places;
            return (
              <li key={`${a.eventId}-${a.memberName}`} className="text-[var(--muted-text)]">
                <span className="text-[var(--foreground)]">{a.memberName === "You" ? a.eventTitle : `${a.memberName} · ${a.eventTitle}`}</span>
                {": "}
                <span className={`tabular-nums ${over ? "font-medium text-[var(--danger)]" : a.used === a.places ? "font-medium text-[var(--warning)]" : ""}`}>
                  {a.used} of {a.places} places allocated
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          action={
            <Link href="/admin/events/new" className="btn-primary">
              Add an event
            </Link>
          }
        >
          Guests are invited to events, so start with your first one.
        </EmptyState>
      ) : (
        <>
          <div role="search" className="mb-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-3 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]" aria-hidden />
              <label htmlFor="guest-search" className="sr-only">
                Search guests
              </label>
              <input
                id="guest-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, email, group"
                className="input-luxe mt-0 pl-9"
              />
            </div>
            <FilterSelect label="Event" value={filters.event} onChange={(v) => navigate({ event: v, page: "1" })}>
              <option value="">All events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Reply" value={filters.status} onChange={(v) => navigate({ status: v, page: "1" })}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </FilterSelect>
            {members.length > 1 ? (
              <FilterSelect label="Added by" value={filters.member} onChange={(v) => navigate({ member: v, page: "1" })}>
                <option value="">Anyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </FilterSelect>
            ) : null}
            {filtered ? (
              <button
                type="button"
                className="btn-ghost col-span-3 justify-self-start text-[var(--muted-text)] sm:col-span-1"
                onClick={() => {
                  setQ("");
                  navigate({ q: "", event: "", status: "", member: "", page: "1" });
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {notice ? (
            <p className="notice-success mb-3 flex items-center justify-between gap-2" role="status">
              {notice}
              <button type="button" className="icon-btn -my-1 -mr-2 h-8 w-8" aria-label="Dismiss" onClick={() => setNotice(null)}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </p>
          ) : null}

          <div className={navPending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={navPending}>
            {totalHouseholds === 0 && !filtered ? (
              <EmptyState
                title="No guests yet"
                action={
                  addableEvents.length > 0 ? (
                    <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Add household
                    </button>
                  ) : null
                }
              >
                Add households one at a time, or import a CSV from an event&apos;s Guests tab.
              </EmptyState>
            ) : rows.length === 0 ? (
              <EmptyState title="No households match these filters" />
            ) : (
              <>
                <p className="sr-only" aria-live="polite">
                  {matchCount} {matchCount === 1 ? "household" : "households"} shown
                </p>

                {/* Phone: one row per household */}
                <ul className="list-rows md:hidden" aria-label="Households">
                  {rows.map((row) => (
                    <li key={row.key} className={`flex gap-3 px-3 py-3 ${selected.has(row.key) ? "bg-[var(--accent-soft)]" : ""}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0 accent-[var(--foreground)]"
                        checked={selected.has(row.key)}
                        onChange={(e) => toggle(row.key, e.target.checked)}
                        aria-label={`Select ${row.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <button type="button" className="block max-w-full text-left font-medium break-words" onClick={() => openEdit(row)}>
                          {row.name}
                        </button>
                        <p className="mt-0.5 text-xs break-words text-[var(--muted-text)]">
                          {[row.group, row.contact || "No contact details"].filter(Boolean).join(" · ")}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {events
                            .filter((e) => row.cells[e.id])
                            .map((e) => (
                              <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-[var(--muted-text)]">{e.title}</span>
                                <CellStatus cell={row.cells[e.id]} />
                              </li>
                            ))}
                        </ul>
                      </div>
                      <RowMenu row={row} events={events} onEdit={openEdit} />
                    </li>
                  ))}
                </ul>

                {/* Desktop table */}
                <div className="app-card hidden overflow-x-auto md:block">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col" className="w-10">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--foreground)]"
                            checked={allSelected}
                            onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.key)))}
                            aria-label="Select all households on this page"
                          />
                        </th>
                        <th scope="col">Household</th>
                        {events.map((e) => (
                          <th key={e.id} scope="col">
                            {e.title}
                          </th>
                        ))}
                        <th scope="col" className="text-right">
                          Places
                        </th>
                        {members.length > 1 ? <th scope="col">Added by</th> : null}
                        <th scope="col" className="w-10">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const places = Math.max(0, ...Object.values(row.cells).map((c) => c?.places ?? 0));
                        return (
                          <tr key={row.key} className={selected.has(row.key) ? "bg-[var(--accent-soft)]" : ""}>
                            <td>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--foreground)]"
                                checked={selected.has(row.key)}
                                onChange={(e) => toggle(row.key, e.target.checked)}
                                aria-label={`Select ${row.name}`}
                              />
                            </td>
                            <td className="max-w-[18rem]">
                              <button type="button" className="text-left font-medium break-words hover:underline" onClick={() => openEdit(row)}>
                                {row.name}
                              </button>
                              <p className="text-xs break-words text-[var(--muted-text)]">
                                {[row.group, row.contact || "No contact details"].filter(Boolean).join(" · ")}
                              </p>
                            </td>
                            {events.map((e) => (
                              <td key={e.id}>
                                <CellStatus cell={row.cells[e.id]} />
                              </td>
                            ))}
                            <td className="text-right tabular-nums">{places}</td>
                            {members.length > 1 ? <td className="text-[var(--muted-text)]">{row.managers.join(", ") || "—"}</td> : null}
                            <td className="text-right">
                              <RowMenu row={row} events={events} onEdit={openEdit} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {pages > 1 ? (
            <nav aria-label="Pages" className="mt-4 flex items-center gap-2 text-sm">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })}>
                Previous
              </button>
              <span className="px-2 text-[var(--muted-text)]">
                Page {page} of {pages}
              </span>
              <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => navigate({ page: String(page + 1) })}>
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}

      {selectedRows.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-2 pl-4 shadow-lg lg:bottom-5 lg:left-[calc(15rem+1.5rem)]"
        >
          <span className="text-sm font-medium">{selectedRows.length} selected</span>
          {bulkEventOptions.length > 1 ? (
            <label className="flex items-center gap-1.5 text-sm text-[var(--muted-text)]">
              <span>at</span>
              <select value={effectiveBulkEvent} onChange={(e) => setBulkEventId(e.target.value)} className="input-luxe mt-0 w-auto py-1">
                {bulkEventOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
          ) : bulkEventOptions[0] ? (
            <span className="text-sm text-[var(--muted-text)]">at {bulkEventOptions[0].title}</span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Link
              href={`/admin/events/${effectiveBulkEvent}?tab=guests&invite=${bulkGuestIds.join(",")}`}
              className={`btn-primary btn-sm ${bulkGuestIds.length === 0 ? "pointer-events-none opacity-50" : ""}`}
              aria-disabled={bulkGuestIds.length === 0}
            >
              Send invitations
            </Link>
            <button type="button" className="btn-secondary btn-sm" disabled={actionPending || bulkGuestIds.length === 0} onClick={() => runBulk("invited")}>
              Mark invited
            </button>
            <Menu label="More bulk actions" placement="top-end" summaryClassName="btn-secondary btn-sm px-2" trigger={<Ellipsis className="h-4 w-4" aria-hidden />}>
              <MenuItem onClick={() => runBulk("uninvited")} disabled={actionPending || bulkGuestIds.length === 0}>
                Mark not invited
              </MenuItem>
              <MenuSeparator />
              <MenuItem tone="danger" onClick={() => runBulk("remove")} disabled={actionPending || bulkGuestIds.length === 0}>
                Remove from event
              </MenuItem>
            </Menu>
            <button type="button" className="icon-btn" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {bulkGuestIds.length < selectedRows.length ? (
            <p className="w-full text-xs text-[var(--muted-text)]">
              {selectedRows.length - bulkGuestIds.length} selected {selectedRows.length - bulkGuestIds.length === 1 ? "isn't" : "aren't"} on this event or
              {" "}managed by someone else, and will be skipped.
            </p>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <GuestFormDialog
          key={`add-${formNonce}`}
          open
          onClose={() => setAdding(false)}
          events={addableEvents.map((e) => ({ id: e.id, title: e.title, allowance: e.allowance }))}
          eventId={filters.event && addableEvents.some((e) => e.id === filters.event) ? filters.event : undefined}
          defaultGreeting={defaultGreeting}
        />
      ) : null}
      {editing ? (
        <GuestFormDialog
          key={`edit-${formNonce}`}
          open
          onClose={() => setEditing(null)}
          guest={editing.form}
          events={[{ id: editing.eventId, title: eventById.get(editing.eventId)?.title ?? "", allowance: eventById.get(editing.eventId)?.allowance ?? null }]}
          eventId={editing.eventId}
          defaultGreeting={defaultGreeting}
        />
      ) : null}
    </>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`input-luxe mt-0 truncate sm:w-auto ${value ? "border-[var(--foreground)]" : ""}`}>
        {children}
      </select>
    </label>
  );
}

function RowMenu({ row, events, onEdit }: { row: DirectoryHousehold; events: DirectoryEvent[]; onEdit: (row: DirectoryHousehold, eventId: string) => void }) {
  const onEvents = events.filter((e) => row.cells[e.id]);
  return (
    <Menu label={`Actions for ${row.name}`} trigger={<Ellipsis className="h-4 w-4" aria-hidden />} panelClassName="w-60">
      {onEvents.map((e) =>
        row.cells[e.id]?.canEdit ? (
          <MenuItem key={`edit-${e.id}`} onClick={() => onEdit(row, e.id)}>
            {onEvents.length > 1 ? `Edit for ${e.title}` : "Edit household"}
          </MenuItem>
        ) : null,
      )}
      {onEvents.length > 0 ? <MenuSeparator /> : null}
      {onEvents.map((e) => (
        <MenuItem key={`open-${e.id}`} href={`/admin/events/${e.id}?tab=guests&q=${encodeURIComponent(row.name)}`}>
          Open in {e.title}
        </MenuItem>
      ))}
    </Menu>
  );
}
