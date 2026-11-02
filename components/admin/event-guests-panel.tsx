"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Ellipsis, Plus, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import {
  bulkDeleteGuestsAction,
  bulkUpdateGuestPlanningAction,
  logBulkWhatsappPreparedAction,
  markGuestsInvitedAction,
  markGuestsUninvitedAction,
  restoreGuestAction,
  sendBulkGuestInviteEmailsAction,
} from "@/app/admin/events/actions";
import { CommunicationPreviewModal } from "@/components/admin/communication-preview-modal";
import { GuestCommunicationHistoryModal } from "@/components/admin/guest-communication-history-modal";
import { GuestCsvImport } from "@/components/admin/guest-csv-import";
import { GuestInviteCardPreviewModal } from "@/components/admin/guest-invite-card-preview-modal";
import { ReviewDuplicatesModal } from "@/components/admin/review-duplicates-modal";
import { SendInvitesModal } from "@/components/admin/send-invites-modal";
import { DeleteGuestDialog, FiltersDialog, RecordReplyDialog } from "@/components/admin/guests/guest-dialogs";
import { GuestFormDialog, type GuestFormEvent } from "@/components/admin/guests/guest-form-dialog";
import { GuestRowActions } from "@/components/admin/guests/guest-row-actions";
import {
  EMPTY_ADVANCED,
  channelLabel,
  confirmedAttendeeRows,
  countActiveAdvanced,
  countedBreakdownOf,
  countedGuestContribution,
  downloadCsv,
  fullDate,
  guestEffectiveExcludedTotal,
  guestExportRows,
  guestPrimaryStatus,
  guestRsvpUrl,
  matchesAdvanced,
  partyLabel,
  rsvpDatasetRows,
  searchHaystack,
  shortDate,
  sortGuests,
  statusLabel,
  totalGuestCount,
  type AdvancedFilters,
  type GuestPanelGuest,
  type GuestStatus,
  type MessageContext,
  type SortKey,
  type StatusFilter,
} from "@/components/admin/guests/guest-model";
import { Dialog } from "@/components/admin/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/admin/ui/menu";
import { EmptyState } from "@/components/admin/planning-ui";
import { buildDuplicateStrengthMap, countDuplicateClusters, countGuestsInDuplicateClusters } from "@/lib/guest-duplicates";
import { isInvitedAwaitingRsvp } from "@/lib/guest-followup";
import { buildGuestWhatsAppInviteMessage } from "@/lib/whatsapp";
import { inviteCardUsingLabel, resolveInviteCardImage, type InviteCardEventInput } from "@/lib/invite-card-resolution";
import { getSafeImageSrc } from "@/lib/utils";

export type { GuestPanelGuest } from "@/components/admin/guests/guest-model";

type Props = {
  eventId: string;
  eventTitle: string;
  eventCoupleNames?: string | null;
  inviteMessageIntro?: string | null;
  inviteMessageLineOverride?: string | null;
  guests: GuestPanelGuest[];
  /** Soft-deleted guests for this event (restore only). */
  deletedGuestsSummary?: Array<{ id: string; guestName: string; deletedAt: string }>;
  siteUrl: string;
  inviteCardEvent: InviteCardEventInput;
  /** Latest communication log per guest (from server) for subtle table hints */
  communicationLastByGuest?: Record<string, { channel: string; at: string }>;
  hasItinerary?: boolean;
  /** Guest IDs who have already been sent an event reminder (from communication log) */
  eventReminderSentGuestIds?: string[];
  eventVenue?: string | null;
  eventTime?: string | null;
  /** Null when the signed-in member cannot add households to this event. */
  addEvent?: GuestFormEvent | null;
  defaultGreeting?: string;
  /** Wedding members who manage households here, when guest lists are split. */
  managers?: { id: string; name: string }[];
  existingGuestNameKeys?: string[];
  emailConfigured?: boolean;
  initialQuery?: string;
  initialInviteIds?: string[];
  initialAction?: "invite" | "remind" | null;
};

type InviteScope = { mode: "invite" | "reminder"; guests: GuestPanelGuest[]; description: string };

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_invited", label: "Not invited" },
  { id: "invited", label: "No reply" },
  { id: "attending", label: "Attending" },
  { id: "declined", label: "Declined" },
];

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function EventGuestsPanel({
  eventId,
  eventTitle,
  eventCoupleNames,
  inviteMessageIntro,
  inviteMessageLineOverride,
  guests,
  deletedGuestsSummary = [],
  siteUrl,
  inviteCardEvent,
  communicationLastByGuest = {},
  hasItinerary = false,
  eventReminderSentGuestIds = [],
  eventVenue,
  eventTime,
  addEvent = null,
  defaultGreeting = "Assalamu Alaikum",
  managers = [],
  existingGuestNameKeys = [],
  emailConfigured = false,
  initialQuery = "",
  initialInviteIds = [],
  initialAction = null,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED);
  const [sort, setSort] = useState<SortKey>("updatedDesc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<{ guest: GuestPanelGuest | null; nonce: number } | null>(null);
  const [replyGuest, setReplyGuest] = useState<GuestPanelGuest | null>(null);
  const [deleteGuest, setDeleteGuest] = useState<GuestPanelGuest | null>(null);
  const [previewMessage, setPreviewMessage] = useState<{ guestId: string; count: number } | null>(null);
  const [cardGuestId, setCardGuestId] = useState<string | null>(null);
  const [historyGuest, setHistoryGuest] = useState<{ id: string; name: string } | null>(null);
  const [planningPrompt, setPlanningPrompt] = useState<"assignGroup" | "assignTable" | null>(null);
  const [inviteScope, setInviteScope] = useState<(InviteScope & { nonce: number }) | null>(null);

  const msgCtx: MessageContext = { siteUrl, eventTitle, eventCoupleNames, inviteMessageIntro, inviteMessageLineOverride, hasItinerary, eventVenue, eventTime };
  const reminderSentSet = useMemo(() => new Set(eventReminderSentGuestIds), [eventReminderSentGuestIds]);
  const duplicateMap = useMemo(() => buildDuplicateStrengthMap(guests), [guests]);
  const duplicateGuestCount = useMemo(() => countGuestsInDuplicateClusters(guests), [guests]);
  const duplicateClusterCount = useMemo(() => countDuplicateClusters(guests), [guests]);
  const groups = useMemo(() => [...new Set(guests.map((g) => g.group?.trim()).filter((s): s is string => Boolean(s)))].sort(), [guests]);
  const tables = useMemo(() => [...new Set(guests.map((g) => g.tableName?.trim()).filter((s): s is string => Boolean(s)))].sort(), [guests]);
  const managerName = useMemo(() => new Map(managers.map((m) => [m.id, m.name])), [managers]);

  const inviteCardByGuest = useMemo(() => {
    const map = new Map<string, { safeSrc: string | null; usingLine: string }>();
    for (const g of guests) {
      const r = resolveInviteCardImage(inviteCardEvent, { maxGuests: totalGuestCount(g), isFamilyInvite: g.isFamilyInvite });
      map.set(g.id, { safeSrc: getSafeImageSrc(r.rawPath), usingLine: inviteCardUsingLabel(r) });
    }
    return map;
  }, [guests, inviteCardEvent]);

  const statusCounts = useMemo(() => {
    const c: Record<GuestStatus, number> = { attending: 0, declined: 0, invited: 0, not_invited: 0 };
    for (const g of guests) c[guestPrimaryStatus(g)] += 1;
    return c;
  }, [guests]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = guests.filter(
      (g) =>
        (!query || searchHaystack(g).includes(query)) &&
        (status === "all" || guestPrimaryStatus(g) === status) &&
        matchesAdvanced(g, advanced, eventId, (id) => duplicateMap.get(id) ?? "none"),
    );
    return sortGuests(list, sort);
  }, [guests, q, status, advanced, sort, eventId, duplicateMap]);

  const viewStats = useMemo(() => {
    let places = 0;
    let men = 0;
    let women = 0;
    let kids = 0;
    let attending = 0;
    for (const g of filtered) {
      places += countedGuestContribution(g);
      const b = countedBreakdownOf(g);
      men += b.men;
      women += b.women;
      kids += b.kids;
      if (countedGuestContribution(g) > 0 && guestPrimaryStatus(g) === "attending") attending += Math.max(g.attendingCount ?? 0, 1);
    }
    return { places, men, women, kids, attending };
  }, [filtered]);

  const advancedCount = countActiveAdvanced(advanced);
  const narrowed = Boolean(q.trim()) || status !== "all" || advancedCount > 0;
  const selectedGuests = filtered.filter((g) => selectedIds.has(g.id));
  const selectedCount = selectedGuests.length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((g) => selectedIds.has(g.id));
  const notInvited = useMemo(() => guests.filter((g) => !g.invitedAt), [guests]);
  const awaiting = useMemo(() => guests.filter((g) => isInvitedAwaitingRsvp(g)), [guests]);
  const needsDecision = guests.filter((g) => g.exclusionKind === "ambiguous");

  function openInvites(mode: "invite" | "reminder", list: GuestPanelGuest[], description: string) {
    setInviteScope({ mode, guests: list, description, nonce: Date.now() });
  }

  useEffect(() => {
    if (initialInviteIds.length > 0) {
      const ids = new Set(initialInviteIds);
      const list = guests.filter((g) => ids.has(g.id));
      setSelectedIds(ids);
      if (list.length) openInvites("invite", list, "selected on the Guests page");
    } else if (initialAction === "invite") {
      openInvites("invite", notInvited, "not invited yet");
    } else if (initialAction === "remind") {
      openInvites("reminder", awaiting, "invited, no reply yet");
    }
    if (initialInviteIds.length > 0 || initialAction) {
      const params = new URLSearchParams(window.location.search);
      params.delete("invite");
      params.delete("send");
      router.replace(`${pathname}?${params}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for deep links
  }, []);

  function toggle(id: string, on: boolean) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function act(fn: () => Promise<unknown>, message?: string) {
    startTransition(async () => {
      await fn();
      if (message) setNotice(message);
      router.refresh();
    });
  }

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice("Couldn't copy. Your browser blocked clipboard access.");
    }
  }

  function exportView(kind: "all" | "view" | "selected" | "confirmed" | "dataset") {
    const dupLabel = (id: string) => {
      const s = duplicateMap.get(id) ?? "none";
      return s === "strong" ? "Duplicate" : s === "weak" ? "Possible duplicate" : "";
    };
    if (kind === "confirmed") return downloadCsv("guests-confirmed-attendees.csv", confirmedAttendeeRows(filtered));
    if (kind === "dataset") return downloadCsv("rsvp-dataset.csv", rsvpDatasetRows(filtered, eventId, siteUrl));
    const source = kind === "all" ? guests : kind === "view" ? filtered : selectedGuests;
    downloadCsv(`guests-${kind === "view" ? "filtered" : kind}.csv`, guestExportRows(source, eventId, dupLabel));
  }

  function bulkPlanning(mode: "assignGroup" | "assignTable" | "clearGroup" | "clearTable", value = "") {
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("guestIds", selectedGuests.map((g) => g.id).join(","));
    fd.set("mode", mode);
    fd.set("value", value);
    act(() => bulkUpdateGuestPlanningAction(fd), "Updated the selected households.");
  }

  const hasGuests = guests.length > 0;

  return (
    <section aria-label="Guest list">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-52 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]" aria-hidden />
          <label htmlFor="guest-list-search" className="sr-only">
            Search guests
          </label>
          <input
            id="guest-list-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guests"
            className="input-luxe mt-0 pl-9 sm:w-52"
          />
        </div>
        <label className="min-w-[9rem] flex-1 sm:hidden">
          <span className="sr-only">Reply</span>
          <select className="input-luxe mt-0" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            {STATUS_TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.id !== "all" ? ` (${statusCounts[t.id as GuestStatus]})` : ` (${guests.length})`}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented hidden sm:inline-flex" role="group" aria-label="Filter by reply">
          {STATUS_TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={status === t.id} onClick={() => setStatus(t.id)}>
              {t.label}
              <span className="ml-1.5 tabular-nums text-[var(--muted-text)]">{t.id === "all" ? guests.length : statusCounts[t.id as GuestStatus]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary px-3" onClick={() => setFiltersOpen(true)} aria-label={advancedCount ? `More filters, ${advancedCount} active` : "More filters"}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden xl:inline">Filters</span>
          {advancedCount ? <span className="rounded bg-[var(--foreground)] px-1.5 text-xs text-white tabular-nums">{advancedCount}</span> : null}
        </button>

        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          {hasGuests ? (
            <Menu
              label="Export guests"
              summaryClassName="btn-secondary px-3"
              panelClassName="w-60"
              trigger={
                <>
                  <Download className="h-4 w-4" aria-hidden />
                  <span className="hidden xl:inline">Export</span>
                </>
              }
            >
              <MenuItem onClick={() => exportView("all")}>All guests (CSV)</MenuItem>
              <MenuItem onClick={() => exportView("view")}>Current view (CSV)</MenuItem>
              <MenuItem onClick={() => exportView("confirmed")}>Confirmed attendees</MenuItem>
              <MenuItem onClick={() => exportView("dataset")}>Full RSVP data with links</MenuItem>
            </Menu>
          ) : null}
          {addEvent ? (
            <>
              <button type="button" className="btn-secondary px-3" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" aria-hidden />
                <span className="hidden xl:inline">Import</span>
                <span className="sr-only xl:hidden">Import from CSV</span>
              </button>
              <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={() => setFormTarget({ guest: null, nonce: Date.now() })}>
                <Plus className="h-4 w-4" aria-hidden />
                Add household
              </button>
            </>
          ) : null}
        </div>
      </div>

      {hasGuests ? (
        <p className="mt-3 text-sm text-[var(--muted-text)]" aria-live="polite">
          {narrowed ? `Showing ${filtered.length} of ${plural(guests.length, "household")}` : plural(guests.length, "household")}
          {" · "}
          {plural(viewStats.places, "place")} ({viewStats.men} men, {viewStats.women} women, {viewStats.kids} kids)
          {viewStats.attending ? ` · ${viewStats.attending} attending` : ""}
          {narrowed ? (
            <>
              {" · "}
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                  setAdvanced(EMPTY_ADVANCED);
                }}
              >
                Clear filters
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {needsDecision.length > 0 || duplicateClusterCount > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {needsDecision.length > 0 ? (
            <li className="notice-warning">
              {plural(needsDecision.length, "household")} {needsDecision.length === 1 ? "needs" : "need"} a counting decision. An older version left{" "}
              {needsDecision.length === 1 ? "it" : "them"} out of this event&apos;s totals without a reason: {needsDecision.slice(0, 4).map((g) => g.guestName).join(", ")}
              {needsDecision.length > 4 ? ` and ${needsDecision.length - 4} more` : ""}. Use <strong>Count here</strong> or <strong>Leave out</strong> in each row&apos;s menu.
            </li>
          ) : null}
          {duplicateClusterCount > 0 ? (
            <li className="flex flex-wrap items-center gap-x-2 text-[var(--muted-text)]">
              {plural(duplicateGuestCount, "household")} may be duplicates (same name, phone or email).
              <button type="button" className="text-link" onClick={() => setDuplicatesOpen(true)}>
                Review
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {notice ? (
        <p className="notice-success mt-3 flex items-center justify-between gap-2" role="status">
          {notice}
          <button type="button" className="icon-btn -my-1 -mr-2 h-8 w-8" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </p>
      ) : null}

      <div className="mt-3">
        {!hasGuests ? (
          <EmptyState
            title="No guests yet"
            action={
              addEvent ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn-primary" onClick={() => setFormTarget({ guest: null, nonce: Date.now() })}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Add household
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}>
                    Import from CSV
                  </button>
                </div>
              ) : null
            }
          >
            {addEvent ? "Add households one at a time or import a spreadsheet." : "Households you're allowed to see will appear here."}
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState title="No households match" />
        ) : (
          <>
            {/* Phone rows */}
            <ul className="list-rows md:hidden" aria-label="Households">
              {filtered.map((g) => (
                <li key={g.id} className={`flex gap-3 px-3 py-3 ${selectedIds.has(g.id) ? "bg-[var(--accent-soft)]" : ""}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--foreground)]"
                    checked={selectedIds.has(g.id)}
                    onChange={(e) => toggle(g.id, e.target.checked)}
                    aria-label={`Select ${g.guestName}`}
                  />
                  <div className="min-w-0 flex-1">
                    <HouseholdCell g={g} eventId={eventId} managerName={managerName} duplicate={duplicateMap.get(g.id) ?? "none"} onOpen={() => (g.canEdit === false ? setReplyGuest(g) : setFormTarget({ guest: g, nonce: Date.now() }))} />
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ReplyCell g={g} />
                      <InvitationCell g={g} reminderOpened={reminderSentSet.has(g.id)} lastLog={communicationLastByGuest[g.id]} compact />
                    </div>
                  </div>
                  <GuestRowActions
                    g={g}
                    eventId={eventId}
                    ctx={msgCtx}
                    emailConfigured={emailConfigured}
                    onEdit={g.canEdit === false ? null : () => setFormTarget({ guest: g, nonce: Date.now() })}
                    onRecordReply={() => setReplyGuest(g)}
                    onPreviewMessage={() => setPreviewMessage({ guestId: g.id, count: 1 })}
                    onCard={() => setCardGuestId(g.id)}
                    onHistory={() => setHistoryGuest({ id: g.id, name: g.guestName })}
                    onDelete={g.canEdit === false ? null : () => setDeleteGuest(g)}
                    onNotice={setNotice}
                  />
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="app-card hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--foreground)]"
                        checked={allVisibleSelected}
                        onChange={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered.map((g) => g.id)))}
                        aria-label="Select all shown households"
                      />
                    </th>
                    <th scope="col">Household</th>
                    <th scope="col">Reply</th>
                    <th scope="col">Invitation</th>
                    <th scope="col" className="w-24">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => (
                    <tr key={g.id} className={selectedIds.has(g.id) ? "bg-[var(--accent-soft)]" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--foreground)]"
                          checked={selectedIds.has(g.id)}
                          onChange={(e) => toggle(g.id, e.target.checked)}
                          aria-label={`Select ${g.guestName}`}
                        />
                      </td>
                      <td className="max-w-[22rem]">
                        <HouseholdCell g={g} eventId={eventId} managerName={managerName} duplicate={duplicateMap.get(g.id) ?? "none"} onOpen={() => (g.canEdit === false ? setReplyGuest(g) : setFormTarget({ guest: g, nonce: Date.now() }))} />
                      </td>
                      <td>
                        <ReplyCell g={g} />
                      </td>
                      <td>
                        <InvitationCell g={g} reminderOpened={reminderSentSet.has(g.id)} lastLog={communicationLastByGuest[g.id]} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <GuestRowActions
                    g={g}
                    eventId={eventId}
                    ctx={msgCtx}
                    emailConfigured={emailConfigured}
                    onEdit={g.canEdit === false ? null : () => setFormTarget({ guest: g, nonce: Date.now() })}
                    onRecordReply={() => setReplyGuest(g)}
                    onPreviewMessage={() => setPreviewMessage({ guestId: g.id, count: 1 })}
                    onCard={() => setCardGuestId(g.id)}
                    onHistory={() => setHistoryGuest({ id: g.id, name: g.guestName })}
                    onDelete={g.canEdit === false ? null : () => setDeleteGuest(g)}
                    onNotice={setNotice}
                  />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {deletedGuestsSummary.length > 0 ? (
        <details className="mt-6 text-sm">
          <summary className="inline-flex min-h-9 cursor-pointer items-center text-[var(--muted-text)] hover:text-[var(--foreground)]">
            Recently removed ({deletedGuestsSummary.length})
          </summary>
          <ul className="list-rows mt-2">
            {deletedGuestsSummary.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {g.guestName}
                  <span className="ml-2 text-xs text-[var(--muted-text)]">Removed {fullDate(g.deletedAt)}</span>
                </span>
                <form action={restoreGuestAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="guestId" value={g.id} />
                  <button type="submit" className="btn-secondary btn-sm">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Contextual bulk actions */}
      {selectedCount > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-2 pl-4 shadow-lg lg:bottom-5 lg:left-[calc(15rem+1.5rem)]"
        >
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn-primary btn-sm" onClick={() => openInvites("invite", selectedGuests, "selected")}>
              Send invitations
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={pending}
              onClick={() => act(() => markGuestsInvitedAction(eventId, selectedGuests.map((g) => g.id), "manual"), `Marked ${plural(selectedCount, "household")} as invited.`)}
            >
              Mark invited
            </button>
            <Menu label="More bulk actions" placement="top-end" summaryClassName="btn-secondary btn-sm px-2" panelClassName="w-64" trigger={<Ellipsis className="h-4 w-4" aria-hidden />}>
              {selectedGuests.some(isInvitedAwaitingRsvp) ? (
                <MenuItem
                  onClick={() => {
                    const list = selectedGuests.filter(isInvitedAwaitingRsvp);
                    openInvites("reminder", list, "selected, no reply yet");
                  }}
                >
                  Send reminders ({selectedGuests.filter(isInvitedAwaitingRsvp).length})
                </MenuItem>
              ) : null}
              <MenuItem
                onClick={() => copy(selectedGuests.map((g) => `${g.guestName}: ${guestRsvpUrl(siteUrl, g.token)}`).join("\n"), `Copied ${plural(selectedCount, "link")}.`)}
              >
                Copy invitation links
              </MenuItem>
              <MenuItem
                onClick={() => {
                  const text = selectedGuests
                    .map(
                      (g) =>
                        `${g.guestName}\n${buildGuestWhatsAppInviteMessage({
                          guestId: g.id,
                          greeting: g.greeting,
                          guestName: g.guestName,
                          eventTitle,
                          coupleNames: eventCoupleNames,
                          rsvpLink: guestRsvpUrl(siteUrl, g.token),
                          customIntroLine: inviteMessageIntro,
                          customLineOverride: inviteMessageLineOverride,
                        })}`,
                    )
                    .join("\n\n---\n\n");
                  void copy(text, `Copied ${plural(selectedCount, "message")}.`);
                  void logBulkWhatsappPreparedAction(eventId, selectedGuests.map((g) => g.id));
                }}
              >
                Copy invitation messages
              </MenuItem>
              <MenuItem onClick={() => setPreviewMessage({ guestId: selectedGuests[0]!.id, count: selectedCount })}>Preview message</MenuItem>
              {emailConfigured ? (
                <MenuItem
                  disabled={!selectedGuests.some((g) => g.email?.trim())}
                  onClick={() =>
                    act(async () => {
                      const r = await sendBulkGuestInviteEmailsAction(eventId, selectedGuests.filter((g) => g.email?.trim()).map((g) => g.id));
                      setNotice(`Email service accepted ${r.sent}. ${r.failed ? `${r.failed} failed. ` : ""}${r.skippedMissingEmail ? `${r.skippedMissingEmail} had no email.` : ""}`);
                    })
                  }
                >
                  Email invitations ({selectedGuests.filter((g) => g.email?.trim()).length})
                </MenuItem>
              ) : null}
              <MenuSeparator />
              <MenuItem onClick={() => setPlanningPrompt("assignGroup")}>Set group…</MenuItem>
              <MenuItem onClick={() => setPlanningPrompt("assignTable")}>Set table…</MenuItem>
              <MenuItem onClick={() => confirm(`Clear the group for ${plural(selectedCount, "household")}?`) && bulkPlanning("clearGroup")}>Clear group</MenuItem>
              <MenuItem onClick={() => confirm(`Clear the table for ${plural(selectedCount, "household")}?`) && bulkPlanning("clearTable")}>Clear table</MenuItem>
              <MenuItem onClick={() => exportView("selected")}>Export selected (CSV)</MenuItem>
              <MenuSeparator />
              <MenuItem
                onClick={() => {
                  if (!confirm(`Mark ${plural(selectedCount, "household")} as not invited? Replies already received stay on file.`)) return;
                  act(() => markGuestsUninvitedAction(eventId, selectedGuests.map((g) => g.id)), `Marked ${plural(selectedCount, "household")} as not invited.`);
                  setSelectedIds(new Set());
                }}
              >
                Mark not invited
              </MenuItem>
              <MenuItem
                tone="danger"
                onClick={() => {
                  if (!confirm(`Remove ${plural(selectedCount, "household")} from this event? You can restore them from “Recently removed”.`)) return;
                  const fd = new FormData();
                  fd.set("eventId", eventId);
                  fd.set("guestIds", selectedGuests.map((g) => g.id).join(","));
                  act(() => bulkDeleteGuestsAction(fd), `Removed ${plural(selectedCount, "household")}.`);
                  setSelectedIds(new Set());
                }}
              >
                Remove from event
              </MenuItem>
            </Menu>
            <button type="button" className="icon-btn" aria-label="Clear selection" onClick={() => setSelectedIds(new Set())}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {/* Dialogs */}
      {formTarget && addEvent ? (
        <GuestFormDialog
          key={formTarget.nonce}
          open
          onClose={() => setFormTarget(null)}
          guest={formTarget.guest}
          events={[addEvent]}
          eventId={eventId}
          defaultGreeting={defaultGreeting}
          inviteCard={formTarget.guest ? inviteCardByGuest.get(formTarget.guest.id) : null}
        />
      ) : null}
      {formTarget && !addEvent && formTarget.guest ? (
        <GuestFormDialog
          key={formTarget.nonce}
          open
          onClose={() => setFormTarget(null)}
          guest={formTarget.guest}
          events={[{ id: eventId, title: eventTitle, allowance: null }]}
          eventId={eventId}
          defaultGreeting={defaultGreeting}
          inviteCard={inviteCardByGuest.get(formTarget.guest.id)}
        />
      ) : null}
      {replyGuest ? <RecordReplyDialog key={replyGuest.id} eventId={eventId} guest={replyGuest} onClose={() => setReplyGuest(null)} /> : null}
      {deleteGuest ? <DeleteGuestDialog key={deleteGuest.id} eventId={eventId} guest={deleteGuest} onClose={() => setDeleteGuest(null)} /> : null}
      {filtersOpen ? (
        <FiltersDialog
          open
          onClose={() => setFiltersOpen(false)}
          value={advanced}
          sort={sort}
          onApply={(f, s) => {
            setAdvanced(f);
            setSort(s);
          }}
          groups={groups}
          tables={tables}
          managers={managers}
          duplicateCount={duplicateGuestCount}
        />
      ) : null}
      {importOpen ? (
        <Dialog open size="lg" onClose={() => setImportOpen(false)} title="Import guests from CSV">
          <GuestCsvImport eventId={eventId} existingGuestNameKeys={existingGuestNameKeys} embedded />
        </Dialog>
      ) : null}
      {planningPrompt ? (
        <PlanningPrompt
          kind={planningPrompt}
          count={selectedCount}
          suggestions={planningPrompt === "assignGroup" ? groups : tables}
          onClose={() => setPlanningPrompt(null)}
          onSave={(value) => {
            bulkPlanning(planningPrompt, value);
            setPlanningPrompt(null);
          }}
        />
      ) : null}

      <CommunicationPreviewModal
        open={previewMessage !== null}
        onClose={() => setPreviewMessage(null)}
        eventId={eventId}
        guestId={previewMessage?.guestId ?? null}
        bulkSampleNote={Boolean(previewMessage && previewMessage.count > 1)}
        selectedCount={previewMessage?.count}
        onViewCommunicationHistory={
          previewMessage
            ? () => {
                const g = guests.find((x) => x.id === previewMessage.guestId);
                if (g) setHistoryGuest({ id: g.id, name: g.guestName });
              }
            : undefined
        }
      />
      <GuestInviteCardPreviewModal
        open={Boolean(cardGuestId)}
        onClose={() => setCardGuestId(null)}
        safeSrc={cardGuestId ? (inviteCardByGuest.get(cardGuestId)?.safeSrc ?? null) : null}
        usingLine={cardGuestId ? (inviteCardByGuest.get(cardGuestId)?.usingLine ?? "") : ""}
        guestName={cardGuestId ? (guests.find((g) => g.id === cardGuestId)?.guestName ?? "") : ""}
      />
      <ReviewDuplicatesModal
        open={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        eventId={eventId}
        eventTitle={eventTitle}
        guests={guests}
        onRequestEditGuest={(id) => {
          const g = guests.find((x) => x.id === id);
          setDuplicatesOpen(false);
          if (g) setFormTarget({ guest: g, nonce: Date.now() });
        }}
      />
      <GuestCommunicationHistoryModal
        open={historyGuest !== null}
        onClose={() => setHistoryGuest(null)}
        eventId={eventId}
        guestId={historyGuest?.id ?? null}
        guestName={historyGuest?.name ?? ""}
      />
      {inviteScope ? (
        <SendInvitesModal
          key={inviteScope.nonce}
          open
          mode={inviteScope.mode}
          onClose={() => setInviteScope(null)}
          eventId={eventId}
          eventTitle={eventTitle}
          eventCoupleNames={eventCoupleNames}
          inviteMessageIntro={inviteMessageIntro}
          inviteMessageLineOverride={inviteMessageLineOverride}
          siteUrl={siteUrl}
          emailConfigured={emailConfigured}
          scopeDescription={inviteScope.description}
          guests={inviteScope.guests.map((g) => ({
            id: g.id,
            guestName: g.guestName,
            greeting: g.greeting,
            token: g.token,
            phone: g.phone,
            phoneCountryCode: g.phoneCountryCode,
            email: g.email,
            invitedAt: g.invitedAt,
          }))}
        />
      ) : null}
    </section>
  );
}

function HouseholdCell({
  g,
  eventId,
  managerName,
  duplicate,
  onOpen,
}: {
  g: GuestPanelGuest;
  eventId: string;
  managerName: Map<string, string>;
  duplicate: "none" | "weak" | "strong";
  onOpen: () => void;
}) {
  const excluded = guestEffectiveExcludedTotal(g);
  const total = totalGuestCount(g);
  const flags: { text: string; warn?: boolean }[] = [];
  if (g.exclusionKind === "ambiguous") flags.push({ text: "Needs a counting decision", warn: true });
  else if (excluded >= total && total > 0) flags.push({ text: g.countOwnerEventId && g.countOwnerEventId !== eventId ? "Counted at another event" : "Left out of totals" });
  else if (excluded > 0) flags.push({ text: `${excluded} of ${total} counted at another event` });
  if (duplicate !== "none") flags.push({ text: duplicate === "strong" ? "Duplicate" : "Possible duplicate", warn: true });
  if (!g.phone?.trim() && !g.email?.trim()) flags.push({ text: "No contact details" });
  const meta = [partyLabel(g), g.group, g.tableName ? `Table ${g.tableName.replace(/^table\s+/i, "")}` : null, g.managedByUserId ? managerName.get(g.managedByUserId) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="min-w-0">
      <button type="button" className="max-w-full text-left font-medium break-words hover:underline" onClick={onOpen}>
        {g.guestName}
      </button>
      <p className="text-xs break-words text-[var(--muted-text)]">{meta}</p>
      {flags.length ? (
        <p className="mt-0.5 text-xs">
          {flags.map((f, i) => (
            <span key={f.text} className={f.warn ? "text-[var(--warning)]" : "text-[var(--muted-text)]"}>
              {i > 0 ? " · " : ""}
              {f.text}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function ReplyCell({ g }: { g: GuestPanelGuest }) {
  const st = guestPrimaryStatus(g);
  if (st === "attending") {
    return (
      <span className="status status-success" title={g.respondedAt ? `Replied ${fullDate(g.respondedAt)}` : undefined}>
        Attending · {Math.max(g.attendingCount ?? 0, 1)} of {totalGuestCount(g)}
      </span>
    );
  }
  if (st === "declined") return <span className="status status-muted">Declined</span>;
  if (st === "invited") return <span className="status status-warning">No reply</span>;
  return <span className="status status-muted">{statusLabel(st)}</span>;
}

function InvitationCell({
  g,
  reminderOpened,
  lastLog,
  compact = false,
}: {
  g: GuestPanelGuest;
  reminderOpened: boolean;
  lastLog?: { channel: string; at: string };
  compact?: boolean;
}) {
  if (!g.invitedAt) return compact ? null : <span className="text-sm text-[var(--muted-text)]">Not sent</span>;
  const via = channelLabel(g.inviteChannelLastUsed);
  return (
    <span className="text-sm text-[var(--muted-text)]" title={lastLog ? `Last action: ${channelLabel(lastLog.channel)}, ${fullDate(lastLog.at)}` : undefined}>
      {g.inviteChannelLastUsed === "manual" ? "Marked invited" : `Sent${via ? ` by ${via}` : ""}`} {shortDate(g.invitedAt)}
      {g.inviteCount > 1 ? ` · ${g.inviteCount} times` : ""}
      {g.lastReminderAt ? ` · reminded ${shortDate(g.lastReminderAt)}` : ""}
      {reminderOpened ? " · event reminder opened" : ""}
    </span>
  );
}

function PlanningPrompt({
  kind,
  count,
  suggestions,
  onClose,
  onSave,
}: {
  kind: "assignGroup" | "assignTable";
  count: number;
  suggestions: string[];
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const label = kind === "assignGroup" ? "Group" : "Table";
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={`Set ${label.toLowerCase()} for ${plural(count, "household")}`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!value.trim()} onClick={() => onSave(value.trim())}>
            Save
          </button>
        </>
      }
    >
      <label className="form-label">
        {label}
        <input autoFocus list="planning-suggestions" value={value} onChange={(e) => setValue(e.target.value)} className="input-luxe" maxLength={120} />
        <datalist id="planning-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
    </Dialog>
  );
}

