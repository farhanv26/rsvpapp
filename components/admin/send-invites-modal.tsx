"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markGuestsInvitedAction,
  recordGuestRemindersSentAction,
  sendBulkGuestInviteEmailsAction,
  sendBulkGuestReminderEmailsAction,
} from "@/app/admin/events/actions";
import { Dialog } from "@/components/admin/ui/dialog";
import { WhatsAppGlyph } from "@/components/admin/guests/guest-row-actions";
import { WHATSAPP_PHONE_HELPER_TEXT } from "@/lib/phone";
import {
  buildGuestRsvpReminderMessage,
  buildGuestWhatsAppInviteMessage,
  getWhatsAppInviteUrlForGuest,
  normalizePhoneForWhatsAppGuestRecord,
} from "@/lib/whatsapp";

/** Minimal guest fields for the invitation workflow. */
export type SendInvitesGuest = {
  id: string;
  guestName: string;
  greeting: string;
  token: string;
  phone: string | null;
  phoneCountryCode: string | null;
  email: string | null;
  invitedAt?: string | null;
};

type Channel = "whatsapp" | "email" | "copy";

function guestRsvpUrl(siteUrl: string, token: string) {
  const path = `/rsvp/${token}`;
  if (!siteUrl) return path;
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  eventCoupleNames?: string | null;
  inviteMessageIntro?: string | null;
  inviteMessageLineOverride?: string | null;
  siteUrl: string;
  guests: SendInvitesGuest[];
  scopeDescription: string;
  /** Reminder flow: RSVP follow-up for guests already invited, not yet responded. */
  mode?: "invite" | "reminder";
  /** Whether the app can send email (an email service is configured). */
  emailConfigured?: boolean;
};

export function SendInvitesModal({
  open,
  onClose,
  eventId,
  eventTitle,
  eventCoupleNames,
  inviteMessageIntro,
  inviteMessageLineOverride,
  siteUrl,
  guests,
  scopeDescription,
  mode = "invite",
  emailConfigured = false,
}: Props) {
  const isReminder = mode === "reminder";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const sorted = useMemo(() => [...guests].sort((a, b) => a.guestName.localeCompare(b.guestName)), [guests]);
  const waReady = useMemo(
    () => sorted.filter((g) => normalizePhoneForWhatsAppGuestRecord({ phone: g.phone, phoneCountryCode: g.phoneCountryCode }) !== null),
    [sorted],
  );
  const withEmail = useMemo(() => sorted.filter((g) => Boolean(g.email?.trim())), [sorted]);
  const noContact = sorted.filter((g) => !g.phone?.trim() && !g.email?.trim()).length;
  const alreadyInvited = isReminder ? 0 : sorted.filter((g) => g.invitedAt).length;

  const [channel, setChannel] = useState<Channel>(waReady.length > 0 ? "whatsapp" : withEmail.length > 0 && emailConfigured ? "email" : "copy");
  const [previewId, setPreviewId] = useState(sorted[0]?.id ?? "");
  const [opened, setOpened] = useState<string[]>([]);
  const [marked, setMarked] = useState<string[]>([]);
  const [status, setStatus] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);
  const openedNotMarked = opened.filter((id) => !marked.includes(id));

  const build = isReminder ? buildGuestRsvpReminderMessage : buildGuestWhatsAppInviteMessage;
  const messageFor = (g: SendInvitesGuest) =>
    build({
      guestId: g.id,
      greeting: g.greeting,
      guestName: g.guestName,
      eventTitle,
      coupleNames: eventCoupleNames,
      rsvpLink: guestRsvpUrl(siteUrl, g.token),
      customIntroLine: inviteMessageIntro,
      customLineOverride: inviteMessageLineOverride,
    });
  const previewGuest = sorted.find((g) => g.id === previewId) ?? sorted[0];
  const nextWa = waReady.find((g) => !opened.includes(g.id));

  function refreshWith(text: string, tone: "success" | "info" | "error" = "success") {
    setStatus({ tone, text });
    router.refresh();
  }

  function openNextWhatsApp() {
    if (!nextWa) return;
    const url = getWhatsAppInviteUrlForGuest(nextWa.phone, messageFor(nextWa), nextWa.phoneCountryCode);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened((o) => [...o, nextWa.id]);
  }

  function recordOpened() {
    const ids = openedNotMarked;
    startTransition(async () => {
      if (isReminder) {
        const r = await recordGuestRemindersSentAction(eventId, ids, "whatsapp");
        refreshWith(`Recorded a reminder for ${r.updated} ${r.updated === 1 ? "household" : "households"}.`);
      } else {
        const r = await markGuestsInvitedAction(eventId, ids, "whatsapp");
        refreshWith(`Marked ${r.updated} ${r.updated === 1 ? "household" : "households"} as invited.`);
      }
      setMarked((m) => [...m, ...ids]);
    });
  }

  function sendEmails() {
    setStatus(null);
    startTransition(async () => {
      const ids = withEmail.map((g) => g.id);
      const r = isReminder ? await sendBulkGuestReminderEmailsAction(eventId, ids) : await sendBulkGuestInviteEmailsAction(eventId, ids);
      if (r.notConfigured) return refreshWith("Email isn't set up for this app, so nothing was sent.", "error");
      const parts = [`The email service accepted ${r.sent} of ${ids.length}.`];
      if (r.failed) parts.push(`${r.failed} failed.`);
      if ("skippedNotEligible" in r && r.skippedNotEligible) parts.push(`${r.skippedNotEligible} skipped because they already replied or weren't invited.`);
      refreshWith(parts.join(" "), r.failed ? "error" : "success");
    });
  }

  function markAllManual() {
    const n = sorted.length;
    if (!confirm(isReminder ? `Record a reminder for all ${n}?` : `Mark all ${n} as invited? Only do this if you sent the invitations yourself.`)) return;
    startTransition(async () => {
      const ids = sorted.map((g) => g.id);
      if (isReminder) {
        const r = await recordGuestRemindersSentAction(eventId, ids, "manual");
        refreshWith(`Recorded a reminder for ${r.updated}.`);
      } else {
        const r = await markGuestsInvitedAction(eventId, ids, "manual");
        refreshWith(`Marked ${r.updated} as invited.`);
      }
    });
  }

  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ tone: "info", text: done });
    } catch {
      setStatus({ tone: "error", text: "Couldn't copy. Your browser blocked clipboard access." });
    }
  }

  function downloadContacts() {
    const rows = [["Guest Name", "Phone", "Email", "RSVP Link"], ...sorted.map((g) => [g.guestName, g.phone ?? "", g.email ?? "", guestRsvpUrl(siteUrl, g.token)])];
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isReminder ? "reminder" : "invite"}-contacts-${eventId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const n = sorted.length;
  const noun = n === 1 ? "household" : "households";
  const unmarked = openedNotMarked.length;

  function requestClose() {
    if (unmarked > 0 && !confirm(`${unmarked} opened in WhatsApp but not ${isReminder ? "recorded as reminded" : "marked invited"}. Close anyway?`)) return;
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      size="lg"
      dismissible={!isPending}
      title={isReminder ? "Send reply reminders" : "Send invitations"}
      description={eventTitle}
      footer={
        unmarked > 0 ? (
          <>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={isPending}>
              Close without marking
            </button>
            <button type="button" className="btn-primary" onClick={recordOpened} disabled={isPending}>
              {isReminder ? `Record ${unmarked} reminded` : `Mark ${unmarked} invited`}
            </button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isPending}>
            Done
          </button>
        )
      }
    >
      {n === 0 ? (
        <p className="text-sm text-[var(--muted-text)]">
          {isReminder ? "Nobody is waiting on a reply right now." : "Everyone here has already been invited."} Select households in the guest list to choose who to send to.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Who */}
          <section aria-labelledby="inv-to">
            <h3 id="inv-to" className="field-name">
              To
            </h3>
            <details className="mt-1 group">
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className="text-sm">
                  <span className="font-medium">
                    {n} {noun}
                  </span>
                  <span className="text-[var(--muted-text)]"> · {scopeDescription}</span>
                </span>
                <span className="text-link shrink-0 text-sm group-open:hidden">Show</span>
                <span className="text-link hidden shrink-0 text-sm group-open:inline">Hide</span>
              </summary>
              <ul className="list-rows mt-2 max-h-56 overflow-y-auto text-sm">
                {sorted.map((g) => {
                  const wa = waReady.some((w) => w.id === g.id);
                  return (
                    <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate">{g.guestName}</span>
                      <span className="shrink-0 text-xs text-[var(--muted-text)]">
                        {[wa ? "WhatsApp" : null, g.email?.trim() ? "Email" : null].filter(Boolean).join(" · ") || "No contact details"}
                        {!isReminder && g.invitedAt ? " · already invited" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
            <p className="mt-1 text-xs text-[var(--muted-text)]">
              {waReady.length} can be reached on WhatsApp{emailConfigured ? ` · ${withEmail.length} by email` : ""}
              {noContact ? ` · ${noContact} have no contact details` : ""}
              {alreadyInvited ? ` · ${alreadyInvited} were already invited` : ""}
            </p>
          </section>

          {/* Message */}
          {previewGuest ? (
            <section aria-labelledby="inv-msg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="inv-msg" className="field-name">
                  Message
                </h3>
                {n > 1 ? (
                  <label className="flex items-center gap-2 text-xs text-[var(--muted-text)]">
                    Preview for
                    <select value={previewGuest.id} onChange={(e) => setPreviewId(e.target.value)} className="input-luxe mt-0 w-auto max-w-[14rem] py-1 text-sm">
                      {sorted.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.guestName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="mt-2 rounded-lg bg-[var(--surface-muted)] p-3">
                <p className="ml-auto max-w-[34rem] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg rounded-tr-sm bg-[var(--surface)] px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_1px_2px_rgba(28,25,21,0.08)]">
                  {messageFor(previewGuest)}
                </p>
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted-text)]">Each household gets its own greeting and private reply link.</p>
            </section>
          ) : null}

          {/* How */}
          <section aria-labelledby="inv-how">
            <h3 id="inv-how" className="field-name">
              Send with
            </h3>
            <div className="segmented mt-1.5" role="group" aria-label="Channel">
              <button type="button" aria-pressed={channel === "whatsapp"} onClick={() => setChannel("whatsapp")}>
                WhatsApp
              </button>
              {emailConfigured ? (
                <button type="button" aria-pressed={channel === "email"} onClick={() => setChannel("email")}>
                  Email
                </button>
              ) : null}
              <button type="button" aria-pressed={channel === "copy"} onClick={() => setChannel("copy")}>
                Copy or export
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-[var(--border-soft)] p-4">
              {channel === "whatsapp" ? (
                waReady.length === 0 ? (
                  <p className="text-sm text-[var(--muted-text)]">
                    Nobody here has a WhatsApp-ready number. {WHATSAPP_PHONE_HELPER_TEXT} You can still copy the messages.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Opens WhatsApp with the message filled in, one household at a time. <strong className="font-semibold">You press send in WhatsApp</strong>; the app
                      can&apos;t see whether it was delivered.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {nextWa ? (
                        <button type="button" className="btn-primary max-w-full" onClick={openNextWhatsApp}>
                          <WhatsAppGlyph />
                          <span className="truncate">Open WhatsApp for {nextWa.guestName}</span>
                        </button>
                      ) : (
                        <span className="text-sm font-semibold">All {waReady.length} opened.</span>
                      )}
                    </div>
                    <ul className="max-h-48 divide-y divide-[var(--border-soft)] overflow-y-auto rounded-md border border-[var(--border-soft)] text-sm" aria-label="WhatsApp progress">
                      {waReady.map((g) => {
                        const state = marked.includes(g.id) ? "marked" : opened.includes(g.id) ? "opened" : "waiting";
                        return (
                          <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="min-w-0 truncate">{g.guestName}</span>
                            <span
                              className={`shrink-0 text-[13px] ${
                                state === "marked" ? "status status-success" : state === "opened" ? "status status-warning" : "text-[var(--muted-text)]"
                              }`}
                            >
                              {state === "marked" ? (isReminder ? "Reminder recorded" : "Marked invited") : state === "opened" ? "Opened, not marked" : "Not opened"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {openedNotMarked.length > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--warning-soft)] px-3 py-2.5">
                        <p className="text-sm">
                          Sent {openedNotMarked.length === 1 ? "it" : "them"}? {isReminder ? "Record the reminder" : "Mark as invited"} so your counts stay right.
                        </p>
                        <button type="button" className="btn-secondary btn-sm" disabled={isPending} onClick={recordOpened}>
                          {isReminder ? `Record ${openedNotMarked.length} reminded` : `Mark ${openedNotMarked.length} invited`}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              ) : channel === "email" ? (
                !emailConfigured ? (
                  <p className="text-sm text-[var(--muted-text)]">
                    Email isn&apos;t set up for this app, so invitations can&apos;t be emailed yet. Use WhatsApp or copy the messages instead.
                  </p>
                ) : withEmail.length === 0 ? (
                  <p className="text-sm text-[var(--muted-text)]">Nobody here has an email address.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Sends from the app to the {withEmail.length} {withEmail.length === 1 ? "household" : "households"} with an email address
                      {withEmail.length < n ? `; ${n - withEmail.length} without one are skipped` : ""}. You&apos;ll see how many the email service accepted, which
                      isn&apos;t proof they arrived.
                    </p>
                    <button type="button" className="btn-primary" disabled={isPending} onClick={sendEmails}>
                      {isPending ? "Sending…" : `Send ${withEmail.length} ${withEmail.length === 1 ? "email" : "emails"}`}
                    </button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => copyText(sorted.map((g) => `${g.guestName}\n${messageFor(g)}`).join("\n\n---\n\n"), `Copied ${n} messages.`)}
                    >
                      Copy all messages
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => copyText(sorted.map((g) => `${g.guestName}: ${guestRsvpUrl(siteUrl, g.token)}`).join("\n"), `Copied ${n} links.`)}
                    >
                      Copy names and links
                    </button>
                    <button type="button" className="btn-secondary" onClick={downloadContacts}>
                      Download contacts (CSV)
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3 text-sm">
                    <span>{isReminder ? "Reminded them another way?" : "Sent them yourself?"}</span>
                    <button type="button" className="btn-ghost btn-sm text-[var(--accent)]" disabled={isPending} onClick={markAllManual}>
                      {isReminder ? `Record reminder for all ${n}` : `Mark all ${n} invited`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {status ? (
            <p className={status.tone === "error" ? "notice-error" : status.tone === "success" ? "notice-success" : "notice-info"} role="status">
              {status.text}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
