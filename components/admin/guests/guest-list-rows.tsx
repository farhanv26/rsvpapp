"use client";

import {
  channelLabel,
  fullDate,
  guestEffectiveExcludedTotal,
  guestPrimaryStatus,
  partyLabel,
  shortDate,
  statusLabel,
  totalGuestCount,
  type GuestPanelGuest,
} from "@/components/admin/guests/guest-model";

type LastLog = { channel: string; at: string };

type RowProps = {
  guests: GuestPanelGuest[];
  eventId: string;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  onToggle: (id: string, on: boolean) => void;
  onToggleAll: () => void;
  onOpen: (g: GuestPanelGuest) => void;
  managerName: Map<string, string>;
  currentUserId?: string;
  duplicateOf: (id: string) => "none" | "weak" | "strong";
  reminderOpened: (id: string) => boolean;
  lastLogOf: (id: string) => LastLog | undefined;
  actions: (g: GuestPanelGuest) => React.ReactNode;
};

/** Households as phone rows below `md` and a fixed-column table above it. */
export function GuestListRows(props: RowProps) {
  const { guests, selectedIds, allVisibleSelected, onToggle, onToggleAll, actions } = props;
  return (
    <>
      <ul className="list-rows md:hidden" aria-label="Households">
        {guests.map((g) => (
          <li key={g.id} className={`flex gap-3 px-3 py-3 ${selectedIds.has(g.id) ? "bg-[var(--accent-soft)]" : ""}`}>
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0"
              checked={selectedIds.has(g.id)}
              onChange={(e) => onToggle(g.id, e.target.checked)}
              aria-label={`Select ${g.guestName}`}
            />
            <div className="min-w-0 flex-1">
              <HouseholdCell g={g} {...props} />
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <ReplyCell g={g} />
                <InvitationCell g={g} reminderOpened={props.reminderOpened(g.id)} lastLog={props.lastLogOf(g.id)} compact />
              </div>
            </div>
            <div className="-mr-1 shrink-0">{actions(g)}</div>
          </li>
        ))}
      </ul>

      <div className="app-card hidden md:block">
        <table className="data-table table-fixed">
          <colgroup>
            <col className="w-11" />
            <col />
            <col className="w-44" />
            <col className="w-56" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <input type="checkbox" className="h-4 w-4" checked={allVisibleSelected} onChange={onToggleAll} aria-label="Select all shown households" />
              </th>
              <th scope="col">Household</th>
              <th scope="col">Reply</th>
              <th scope="col">Invitation</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} className={selectedIds.has(g.id) ? "bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]" : ""}>
                <td>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedIds.has(g.id)}
                    onChange={(e) => onToggle(g.id, e.target.checked)}
                    aria-label={`Select ${g.guestName}`}
                  />
                </td>
                <td>
                  <HouseholdCell g={g} {...props} />
                </td>
                <td>
                  <ReplyCell g={g} />
                </td>
                <td>
                  <InvitationCell g={g} reminderOpened={props.reminderOpened(g.id)} lastLog={props.lastLogOf(g.id)} />
                </td>
                <td className="py-2 text-right whitespace-nowrap">{actions(g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HouseholdCell({
  g,
  eventId,
  managerName,
  currentUserId,
  duplicateOf,
  onOpen,
}: { g: GuestPanelGuest } & Pick<RowProps, "eventId" | "managerName" | "currentUserId" | "duplicateOf" | "onOpen">) {
  const excluded = guestEffectiveExcludedTotal(g);
  const total = totalGuestCount(g);
  const duplicate = duplicateOf(g.id);
  const flags: { text: string; warn?: boolean }[] = [];
  if (g.exclusionKind === "ambiguous") flags.push({ text: "Needs a counting decision", warn: true });
  else if (excluded >= total && total > 0) flags.push({ text: g.countOwnerEventId && g.countOwnerEventId !== eventId ? "Counted at another event" : "Left out of totals" });
  else if (excluded > 0) flags.push({ text: `${excluded} of ${total} counted at another event` });
  if (duplicate !== "none") flags.push({ text: duplicate === "strong" ? "Duplicate" : "Possible duplicate", warn: true });
  if (!g.phone?.trim() && !g.email?.trim()) flags.push({ text: "No contact details" });
  const owner = g.managedByUserId ? (g.managedByUserId === currentUserId ? "Your list" : managerName.get(g.managedByUserId)) : null;
  const meta = [partyLabel(g), g.group, g.tableName ? `Table ${g.tableName.replace(/^table\s+/i, "")}` : null].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0">
      <button type="button" className="max-w-full text-left font-semibold break-words hover:underline" onClick={() => onOpen(g)}>
        {g.guestName}
      </button>
      <p className="text-[13px] break-words text-[var(--muted-text)]">
        {meta}
        {owner ? (
          <>
            {meta ? " · " : ""}
            <span className="text-[var(--foreground)]">{owner}</span>
          </>
        ) : null}
      </p>
      {flags.length ? (
        <p className="mt-0.5 text-xs">
          {flags.map((f, i) => (
            <span key={f.text} className={f.warn ? "font-medium text-[var(--warning)]" : "text-[var(--muted-text)]"}>
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
      <span className="status status-success tabular-nums" title={g.respondedAt ? `Replied ${fullDate(g.respondedAt)}` : undefined}>
        Attending · {Math.max(g.attendingCount ?? 0, 1)} of {totalGuestCount(g)}
      </span>
    );
  }
  if (st === "declined") return <span className="status status-muted">Declined</span>;
  if (st === "invited") return <span className="status status-warning">{statusLabel(st)}</span>;
  return <span className="status status-muted">{statusLabel(st)}</span>;
}

/** Separates "we opened a message for you" from "you told us it was sent". */
function InvitationCell({ g, reminderOpened, lastLog, compact = false }: { g: GuestPanelGuest; reminderOpened: boolean; lastLog?: LastLog; compact?: boolean }) {
  if (!g.invitedAt) {
    if (lastLog) {
      return (
        <span className="text-[13px] text-[var(--warning)]" title={`${channelLabel(lastLog.channel)}, ${fullDate(lastLog.at)}`}>
          Message opened {shortDate(lastLog.at)} · not marked invited
        </span>
      );
    }
    return compact ? null : <span className="text-[13px] text-[var(--muted-text)]">Not sent</span>;
  }
  const via = g.inviteChannelLastUsed && g.inviteChannelLastUsed !== "manual" ? channelLabel(g.inviteChannelLastUsed) : null;
  return (
    <span className="text-[13px] text-[var(--muted-text)]" title={lastLog ? `Last message: ${channelLabel(lastLog.channel)}, ${fullDate(lastLog.at)}` : undefined}>
      <span className="text-[var(--foreground)]">Invited {shortDate(g.invitedAt)}</span>
      {via ? ` · ${via}` : ""}
      {g.inviteCount > 1 ? ` · ${g.inviteCount} times` : ""}
      {g.lastReminderAt ? ` · reminded ${shortDate(g.lastReminderAt)}` : ""}
      {reminderOpened ? " · event reminder opened" : ""}
    </span>
  );
}
