"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getGuestCommunicationHistoryAction,
  type GuestCommunicationActionCategory,
  type GuestCommunicationHistoryEntry,
} from "@/app/admin/events/actions";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function channelLabelUi(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "Email";
  if (channel === "manual") return "Manual";
  return channel;
}

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  guestId: string | null;
  guestName: string;
};

export function GuestCommunicationHistoryModal({ open, onClose, eventId, guestId, guestName }: Props) {
  const [channel, setChannel] = useState<string>("all");
  const [actionCategory, setActionCategory] = useState<"all" | GuestCommunicationActionCategory>("all");
  const [limit, setLimit] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<GuestCommunicationHistoryEntry[]>([]);

  const load = useCallback(async () => {
    if (!guestId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getGuestCommunicationHistoryAction(eventId, guestId, {
        channel: channel === "all" ? undefined : channel,
        limit,
        actionCategory: actionCategory === "all" ? "all" : actionCategory,
      });
      if (!res.ok) {
        setEntries([]);
        setError("Could not load history.");
        return;
      }
      setEntries(res.entries);
    } catch {
      setError("Could not load history.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, guestId, channel, limit, actionCategory]);

  useEffect(() => {
    if (open && guestId) {
      void load();
    }
  }, [open, guestId, load]);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setError(null);
      setChannel("all");
      setActionCategory("all");
      setLimit(50);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa] shadow-xl">
        <div className="border-b border-[#efe4d4] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Communication history</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">{guestName}</h2>
              <p className="mt-1 text-xs text-zinc-600">Newest first. Logged when you use send, mark, WhatsApp, or email.</p>
            </div>
            <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-600" htmlFor="comm-history-channel">
                Channel
              </label>
              <select
                id="comm-history-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="rounded-xl border border-[#dccfbb] bg-white px-2 py-1.5 text-xs text-zinc-900"
              >
                <option value="all">All</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-600" htmlFor="comm-history-action">
                Action
              </label>
              <select
                id="comm-history-action"
                value={actionCategory}
                onChange={(e) =>
                  setActionCategory(e.target.value as "all" | GuestCommunicationActionCategory)
                }
                className="rounded-xl border border-[#dccfbb] bg-white px-2 py-1.5 text-xs text-zinc-900"
              >
                <option value="all">All</option>
                <option value="invite_marked">Invite marked sent</option>
                <option value="whatsapp">WhatsApp prepared</option>
                <option value="email_invite">Email invite</option>
                <option value="email_reminder">Email reminder</option>
                <option value="reminder_recorded">Reminder recorded</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-600" htmlFor="comm-history-limit">
                Show
              </label>
              <select
                id="comm-history-limit"
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl border border-[#dccfbb] bg-white px-2 py-1.5 text-xs text-zinc-900"
              >
                <option value="10">10 recent</option>
                <option value="25">25 recent</option>
                <option value="50">50 recent</option>
                <option value="100">100 recent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-600">Loading…</p>
          ) : error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
          ) : entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-8 text-center text-sm text-zinc-600">
              No entries match these filters. Try &quot;All&quot; channel and action, or a larger &quot;Show&quot; window.
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900">{e.label}</span>
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                      {channelLabelUi(e.channel)}
                      {!e.success ? " · issue" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{formatWhen(e.createdAt)}</p>
                  {e.actorName ? (
                    <p className="mt-0.5 text-xs text-zinc-600">By {e.actorName}</p>
                  ) : null}
                  {e.detail ? (
                    <p className="mt-2 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-700">
                      {e.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
