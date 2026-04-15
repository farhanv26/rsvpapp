"use client";

import { useRouter } from "next/navigation";
import { bulkDeleteGuestsAction, deleteGuestAction } from "@/app/admin/events/actions";
import {
  buildDuplicateClusters,
  duplicateReasonLabels,
  type DuplicateCluster,
} from "@/lib/guest-duplicates";

/** Same shape as GuestPanelGuest — kept local to avoid circular imports with the panel. */
export type DuplicateReviewGuest = {
  id: string;
  guestName: string;
  greeting: string;
  maxGuests: number;
  token: string;
  attending: boolean | null;
  attendingCount: number | null;
  respondedAt: string | null;
  phone: string | null;
  email: string | null;
  invitedAt: string | null;
  inviteChannelLastUsed: string | null;
  inviteCount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  guests: DuplicateReviewGuest[];
  onRequestEditGuest: (guestId: string) => void;
};

function statusOf(g: DuplicateReviewGuest): "pending" | "attending" | "declined" {
  if (!g.respondedAt) return "pending";
  if (g.attending === true) return "attending";
  return "declined";
}

function statusLabel(s: ReturnType<typeof statusOf>) {
  if (s === "pending") return "Pending";
  if (s === "attending") return "Attending";
  return "Declined";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function deletionWarnings(g: DuplicateReviewGuest): string[] {
  const w: string[] = [];
  if (g.respondedAt) w.push("Has an RSVP on file — deleting loses that response.");
  if (g.invitedAt) w.push("Was marked as invited — invite history will be removed.");
  if ((g.inviteCount ?? 0) > 0) w.push(`Invite/reminder activity count: ${g.inviteCount}.`);
  return w;
}

export function ReviewDuplicatesModal({
  open,
  onClose,
  eventId,
  eventTitle,
  guests,
  onRequestEditGuest,
}: Props) {
  const router = useRouter();
  if (!open) return null;

  const byId = new Map(guests.map((g) => [g.id, g]));
  const clusters: DuplicateCluster[] = buildDuplicateClusters(guests);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,56rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffcf6] shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ebe4d6] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Review duplicates</p>
            <h2 className="font-display text-xl font-semibold text-zinc-900">{eventTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {clusters.length === 0
                ? "No duplicate groups detected with current rules."
                : `${clusters.length} group${clusters.length === 1 ? "" : "s"} · compare fields, edit, or remove extras safely.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {clusters.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-8 text-center text-sm text-zinc-600">
              Your guest list looks clean — no matching names, phones, or emails within this event.
            </p>
          ) : (
            <div className="space-y-8">
              {clusters.map((cluster, idx) => {
                const members = cluster.guestIds
                  .map((id) => byId.get(id))
                  .filter((g): g is DuplicateReviewGuest => Boolean(g))
                  .sort((a, b) => a.guestName.localeCompare(b.guestName));
                const reasonText = duplicateReasonLabels(cluster.reasons).join(" · ");

                return (
                  <section
                    key={[...cluster.guestIds].sort().join("-")}
                    className="rounded-2xl border border-[#e7dccb] bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          Group {idx + 1}{" "}
                          <span className="font-normal text-zinc-500">
                            ({members.length} guest{members.length === 1 ? "" : "s"})
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          <span className="font-medium text-zinc-700">Flagged:</span> {reasonText}
                        </p>
                      </div>
                      {members.length > 1 ? (
                        <form
                          action={bulkDeleteGuestsAction}
                          onSubmit={(e) => {
                            const first = members[0];
                            if (
                              !confirm(
                                `Keep “${first.guestName}” and delete ${members.length - 1} other entr${members.length === 2 ? "y" : "ies"} in this group? This cannot be undone.`,
                              )
                            ) {
                              e.preventDefault();
                              return;
                            }
                            const extra = members.slice(1);
                            const hasRisk = extra.some((g) => g.respondedAt || g.invitedAt);
                            if (
                              hasRisk &&
                              !confirm(
                                "Some rows have RSVP or invite data. Are you sure you want to delete those records?",
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="guestIds" value={members.slice(1).map((g) => g.id).join(",")} />
                          <button type="submit" className="btn-secondary text-sm">
                            Keep first, delete others
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-[#efe4d4]">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead className="bg-[#f7efe2] text-xs uppercase tracking-wide text-zinc-600">
                          <tr>
                            <th className="px-3 py-2">Guest name</th>
                            <th className="px-3 py-2">Greeting</th>
                            <th className="px-3 py-2">Phone</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Max</th>
                            <th className="px-3 py-2">RSVP</th>
                            <th className="px-3 py-2">Invited</th>
                            <th className="px-3 py-2">Responded</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-zinc-800">
                          {members.map((g) => {
                            const st = statusOf(g);
                            const warns = deletionWarnings(g);
                            return (
                              <tr
                                key={g.id}
                                className="border-t border-[#f0e7d9]"
                                title={warns.length > 0 ? warns.join(" ") : undefined}
                              >
                                <td className="px-3 py-2 font-medium">{g.guestName}</td>
                                <td className="px-3 py-2 text-xs text-zinc-600">{g.greeting || "—"}</td>
                                <td className="px-3 py-2 text-xs">{g.phone?.trim() || "—"}</td>
                                <td className="px-3 py-2 text-xs">{g.email?.trim() || "—"}</td>
                                <td className="px-3 py-2 tabular-nums">{g.maxGuests}</td>
                                <td className="px-3 py-2 text-xs">{statusLabel(st)}</td>
                                <td className="px-3 py-2 text-xs">{g.invitedAt ? formatDate(g.invitedAt) : "—"}</td>
                                <td className="px-3 py-2 text-xs">{g.respondedAt ? formatDate(g.respondedAt) : "—"}</td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      className="btn-secondary px-2 py-1 text-xs"
                                      onClick={() => {
                                        onRequestEditGuest(g.id);
                                        onClose();
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <form
                                      action={deleteGuestAction}
                                      className="inline"
                                      onSubmit={(e) => {
                                        const w = deletionWarnings(g);
                                        const msg =
                                          w.length > 0
                                            ? `Delete “${g.guestName}”?\n\n${w.join("\n")}\n\nThis cannot be undone.`
                                            : `Delete “${g.guestName}”? This cannot be undone.`;
                                        if (!confirm(msg)) e.preventDefault();
                                      }}
                                    >
                                      <input type="hidden" name="eventId" value={eventId} />
                                      <input type="hidden" name="guestId" value={g.id} />
                                      <button type="submit" className="btn-secondary border-rose-200 px-2 py-1 text-xs text-rose-700">
                                        Delete
                                      </button>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {members.some((g) => deletionWarnings(g).length > 0) ? (
                      <p className="mt-3 text-xs text-amber-900/90">
                        Rows with RSVP or invite history need an extra confirmation before deletion.
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#ebe4d6] px-5 py-3 sm:px-6">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              router.refresh();
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
