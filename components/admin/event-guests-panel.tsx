"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Ellipsis, Plus, X } from "lucide-react";
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
import { BulkBar } from "@/components/admin/guests/bulk-bar";
import { DeleteGuestDialog, FiltersDialog, RecordReplyDialog } from "@/components/admin/guests/guest-dialogs";
import { GuestFormDialog, type GuestFormEvent } from "@/components/admin/guests/guest-form-dialog";
import { GuestListRows } from "@/components/admin/guests/guest-list-rows";
import { GuestListToolbar, type ExportKind } from "@/components/admin/guests/guest-list-toolbar";
import { GuestRowActions } from "@/components/admin/guests/guest-row-actions";
import { PlanningPrompt } from "@/components/admin/guests/planning-prompt";
import {
  EMPTY_ADVANCED,
  confirmedAttendeeRows,
  countActiveAdvanced,
  countedBreakdownOf,
  countedGuestContribution,
  downloadCsv,
  fullDate,
  guestExportRows,
  guestPrimaryStatus,
  guestRsvpUrl,
  matchesAdvanced,
  rsvpDatasetRows,
  searchHaystack,
  sortGuests,
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
  currentUserId?: string;
  existingGuestNameKeys?: string[];
  emailConfigured?: boolean;
  initialQuery?: string;
  initialInviteIds?: string[];
  initialAction?: "invite" | "remind" | null;
};

type InviteScope = { mode: "invite" | "reminder"; guests: GuestPanelGuest[]; description: string };
type Notice = { text: string; markGuest?: GuestPanelGuest; channel?: "whatsapp" | "imessage" };

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
  currentUserId,
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
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const setNotice = (text: string | null) => setNoticeState(text ? { text } : null);

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
      openInvites("reminder", awaiting, "awaiting a reply");
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

  function exportView(kind: ExportKind) {
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

  const openGuest = (g: GuestPanelGuest) => (g.canEdit === false ? setReplyGuest(g) : setFormTarget({ guest: g, nonce: Date.now() }));
  const hasGuests = guests.length > 0;
  const summary = hasGuests ? (
    <>
      {narrowed ? `${filtered.length} of ${plural(guests.length, "household")} · ${plural(viewStats.places, "place")}` : plural(guests.length, "household")}
      <span className="hidden sm:inline">
        {" · "}
        {viewStats.men} men, {viewStats.women} women, {viewStats.kids} kids
      </span>
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
    </>
  ) : null;

  return (
    <section aria-label="Guest list">
      <GuestListToolbar
        summary={summary}
        q={q}
        onQuery={setQ}
        status={status}
        onStatus={setStatus}
        statusCounts={statusCounts}
        total={guests.length}
        advancedCount={advancedCount}
        onOpenFilters={() => setFiltersOpen(true)}
        hasGuests={hasGuests}
        canAdd={Boolean(addEvent)}
        onImport={() => setImportOpen(true)}
        onAdd={() => setFormTarget({ guest: null, nonce: Date.now() })}
        onExport={exportView}
        selecting={selectedCount > 0}
      />

      {needsDecision.length > 0 || duplicateClusterCount > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {needsDecision.length > 0 ? (
            <li className="notice-warning">
              {plural(needsDecision.length, "household")} {needsDecision.length === 1 ? "needs" : "need"} a counting decision:{" "}
              {needsDecision.slice(0, 4).map((g) => g.guestName).join(", ")}
              {needsDecision.length > 4 ? ` and ${needsDecision.length - 4} more` : ""}. Choose <strong>Count here</strong> or <strong>Leave out of totals</strong> in each
              row&apos;s menu.
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
        <div className="notice-success mt-3 flex flex-wrap items-center justify-between gap-2" role="status">
          <span>{notice.text}</span>
          <span className="flex items-center gap-1">
            {notice.markGuest ? (
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={pending}
                onClick={() => {
                  const g = notice.markGuest!;
                  act(() => markGuestsInvitedAction(eventId, [g.id], notice.channel ?? "manual"), `Marked ${g.guestName} as invited.`);
                }}
              >
                Mark invited
              </button>
            ) : null}
            <button type="button" className="icon-btn -my-1 -mr-2 h-8 w-8" aria-label="Dismiss" onClick={() => setNotice(null)}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </span>
        </div>
      ) : null}

      <div className="mt-4">
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
          <GuestListRows
            guests={filtered}
            eventId={eventId}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            onToggle={toggle}
            onToggleAll={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered.map((g) => g.id)))}
            onOpen={openGuest}
            managerName={managerName}
            currentUserId={currentUserId}
            duplicateOf={(id) => duplicateMap.get(id) ?? "none"}
            reminderOpened={(id) => reminderSentSet.has(id)}
            lastLogOf={(id) => communicationLastByGuest[id]}
            actions={(g) => (
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
                onComposerOpened={(channel) =>
                  setNoticeState({
                    text: `${channel === "whatsapp" ? "WhatsApp" : "Messages"} opened for ${g.guestName}. Sent it?`,
                    markGuest: g,
                    channel,
                  })
                }
              />
            )}
          />
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

      {selectedCount > 0 ? (
        <BulkBar count={selectedCount} onClear={() => setSelectedIds(new Set())}>
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
          <Menu label="More actions for selected households" placement="top-end" summaryClassName="btn-secondary btn-sm px-2" panelClassName="w-64" trigger={<Ellipsis className="h-4 w-4" aria-hidden />}>
            {selectedGuests.some(isInvitedAwaitingRsvp) ? (
              <MenuItem
                onClick={() => {
                  const list = selectedGuests.filter(isInvitedAwaitingRsvp);
                  openInvites("reminder", list, "selected, awaiting a reply");
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
        </BulkBar>
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
