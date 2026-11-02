"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGuestAction, recordGuestManualRsvpAction } from "@/app/admin/events/actions";
import { Dialog } from "@/components/admin/ui/dialog";
import { EMPTY_ADVANCED, type AdvancedFilters, type GuestPanelGuest, type SortKey } from "@/components/admin/guests/guest-model";

/** Record a reply received by phone, in person or through family. */
export function RecordReplyDialog({ eventId, guest, onClose }: { eventId: string; guest: GuestPanelGuest; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attending, setAttending] = useState<"yes" | "no">("yes");
  const [count, setCount] = useState(String(Math.max(1, guest.attendingCount ?? guest.maxGuests ?? 1)));
  const [names, setNames] = useState("");
  const [note, setNote] = useState("");
  const [markInvited, setMarkInvited] = useState(!guest.invitedAt);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await recordGuestManualRsvpAction({
          eventId,
          guestId: guest.id,
          attending,
          attendingCount: attending === "yes" ? Number(count || "0") : 0,
          attendeeNames: names,
          note,
          markInvitedIfMissing: markInvited,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this reply.");
      }
    });
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      dismissible={!pending}
      title="Record reply"
      description={guest.guestName}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save reply"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="notice-error" role="alert">
            {error}
          </p>
        ) : null}
        <fieldset>
          <legend className="form-label">Reply</legend>
          <div className="segmented mt-1.5" role="group">
            <button type="button" aria-pressed={attending === "yes"} onClick={() => setAttending("yes")}>
              Attending
            </button>
            <button type="button" aria-pressed={attending === "no"} onClick={() => setAttending("no")}>
              Can&apos;t attend
            </button>
          </div>
        </fieldset>
        {attending === "yes" ? (
          <label className="form-label">
            How many are coming
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={guest.maxGuests}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="input-luxe w-28 tabular-nums"
            />
            <span className="field-hint">Up to {guest.maxGuests} invited.</span>
          </label>
        ) : null}
        <label className="form-label">
          Names (optional)
          <input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Ahmad, Aisha, Nani" className="input-luxe" />
        </label>
        <label className="form-label">
          Note (optional)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Confirmed by phone" className="input-luxe" />
        </label>
        {!guest.invitedAt ? (
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={markInvited} onChange={(e) => setMarkInvited(e.target.checked)} className="h-4 w-4 accent-[var(--foreground)]" />
            Also mark as invited
          </label>
        ) : null}
      </div>
    </Dialog>
  );
}

export function DeleteGuestDialog({ eventId, guest, onClose }: { eventId: string; guest: GuestPanelGuest; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      dismissible={!pending}
      title={`Remove ${guest.guestName}?`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const fd = new FormData();
                  fd.set("eventId", eventId);
                  fd.set("guestId", guest.id);
                  await deleteGuestAction(fd);
                  router.refresh();
                  onClose();
                } catch {
                  setError("Couldn't remove this household. Please try again.");
                }
              })
            }
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        </>
      }
    >
      {error ? (
        <p className="notice-error mb-3" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-sm">
        Their invitation link stops working and they leave this event&apos;s totals. Their reply and history are kept, and you can restore them from
        &ldquo;Recently removed&rdquo; at the bottom of the guest list.
      </p>
    </Dialog>
  );
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "updatedDesc", label: "Recently updated" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "status", label: "Reply" },
  { value: "groupAsc", label: "Group" },
  { value: "tableAsc", label: "Table" },
  { value: "maxGuestsDesc", label: "Largest party first" },
];

export function FiltersDialog({
  open,
  onClose,
  value,
  sort,
  onApply,
  groups,
  tables,
  managers,
  duplicateCount,
}: {
  open: boolean;
  onClose: () => void;
  value: AdvancedFilters;
  sort: SortKey;
  onApply: (f: AdvancedFilters, sort: SortKey) => void;
  groups: string[];
  tables: string[];
  managers: { id: string; name: string }[];
  duplicateCount: number;
}) {
  const [draft, setDraft] = useState(value);
  const [draftSort, setDraftSort] = useState(sort);
  const set = <K extends keyof AdvancedFilters>(k: K, v: AdvancedFilters[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filter and sort"
      footer={
        <>
          <button type="button" className="btn-ghost mr-auto" onClick={() => { setDraft(EMPTY_ADVANCED); setDraftSort("updatedDesc"); }}>
            Reset
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onApply(draft, draftSort);
              onClose();
            }}
          >
            Apply
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-label">
          Sort by
          <select className="input-luxe" value={draftSort} onChange={(e) => setDraftSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Sent by
          <select className="input-luxe" value={draft.channel} onChange={(e) => set("channel", e.target.value as AdvancedFilters["channel"])}>
            <option value="all">Any channel</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="imessage">Text message</option>
            <option value="email">Email</option>
            <option value="manual">Marked by hand</option>
          </select>
        </label>
        <label className="form-label">
          Contact details
          <select className="input-luxe" value={draft.contact} onChange={(e) => set("contact", e.target.value as AdvancedFilters["contact"])}>
            <option value="all">Any</option>
            <option value="ready">Phone and email, not invited</option>
            <option value="missing_phone">Missing phone</option>
            <option value="missing_email">Missing email</option>
            <option value="missing_contact">No phone or email</option>
          </select>
        </label>
        <label className="form-label">
          Duplicates
          <select className="input-luxe" value={draft.duplicates} onChange={(e) => set("duplicates", e.target.value as AdvancedFilters["duplicates"])}>
            <option value="all">Any</option>
            <option value="has_duplicates">Possible duplicates{duplicateCount ? ` (${duplicateCount})` : ""}</option>
            <option value="clean">No duplicates</option>
          </select>
        </label>
        <label className="form-label">
          Counting
          <select className="input-luxe" value={draft.counting} onChange={(e) => set("counting", e.target.value as AdvancedFilters["counting"])}>
            <option value="all">Any</option>
            <option value="counted">Fully counted here</option>
            <option value="excluded">Partly or fully left out</option>
            <option value="shared">Also invited to other events</option>
            <option value="counted_here">Counted at this event</option>
            <option value="counted_elsewhere">Counted at another event</option>
          </select>
        </label>
        <label className="form-label">
          Group
          <select className="input-luxe" value={draft.group} onChange={(e) => set("group", e.target.value)}>
            <option value="all">Any group</option>
            <option value="__none__">No group</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Table
          <select className="input-luxe" value={draft.table} onChange={(e) => set("table", e.target.value)}>
            <option value="all">Any table</option>
            <option value="unassigned">No table</option>
            <option value="assigned">Has a table</option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {managers.length > 0 ? (
          <label className="form-label">
            Added by
            <select className="input-luxe" value={draft.manager} onChange={(e) => set("manager", e.target.value)}>
              <option value="all">Anyone</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="__none__">Organizer list</option>
            </select>
          </label>
        ) : null}
      </div>
    </Dialog>
  );
}
