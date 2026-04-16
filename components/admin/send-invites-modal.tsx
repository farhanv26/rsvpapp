"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markGuestsInvitedAction,
  recordGuestRemindersSentAction,
  sendBulkGuestInviteEmailsAction,
  sendBulkGuestReminderEmailsAction,
} from "@/app/admin/events/actions";
import {
  buildGuestRsvpReminderMessage,
  buildGuestWhatsAppInviteMessage,
  getWhatsAppInviteUrlForGuest,
  normalizePhoneForWhatsApp,
} from "@/lib/whatsapp";

/** Minimal guest fields for invite workflow (compatible with GuestPanelGuest). */
export type SendInvitesGuest = {
  id: string;
  guestName: string;
  greeting: string;
  token: string;
  phone: string | null;
  email: string | null;
};

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

function hasPhone(g: SendInvitesGuest) {
  return Boolean(g.phone?.trim());
}
function hasEmail(g: SendInvitesGuest) {
  return Boolean(g.email?.trim());
}
function missingContact(g: SendInvitesGuest) {
  return !hasPhone(g) && !hasEmail(g);
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
}: Props) {
  const isReminder = mode === "reminder";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [waIndex, setWaIndex] = useState(0);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [markStatus, setMarkStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const sortedGuests = useMemo(
    () => [...guests].sort((a, b) => a.guestName.localeCompare(b.guestName)),
    [guests],
  );

  const waPhoneEligible = useMemo(
    () => sortedGuests.filter((g) => normalizePhoneForWhatsApp(g.phone) !== null),
    [sortedGuests],
  );

  const waStep = Math.min(waIndex, Math.max(0, waPhoneEligible.length - 1));

  const summary = useMemo(() => {
    const total = guests.length;
    const withPhone = guests.filter(hasPhone).length;
    const withEmail = guests.filter(hasEmail).length;
    const missing = guests.filter(missingContact).length;
    return { total, withPhone, withEmail, missing };
  }, [guests]);

  const sampleGuest = sortedGuests[0];
  const sampleMessage = useMemo(() => {
    if (!sampleGuest) return "";
    const build = isReminder ? buildGuestRsvpReminderMessage : buildGuestWhatsAppInviteMessage;
    return build({
      guestId: sampleGuest.id,
      greeting: sampleGuest.greeting,
      guestName: sampleGuest.guestName,
      eventTitle,
      coupleNames: eventCoupleNames,
      rsvpLink: guestRsvpUrl(siteUrl, sampleGuest.token),
      customIntroLine: inviteMessageIntro,
      customLineOverride: inviteMessageLineOverride,
    });
  }, [sampleGuest, eventTitle, eventCoupleNames, siteUrl, inviteMessageIntro, inviteMessageLineOverride, isReminder]);

  const waGuest = waPhoneEligible[waStep];
  const waMessage = useMemo(() => {
    if (!waGuest) return "";
    const build = isReminder ? buildGuestRsvpReminderMessage : buildGuestWhatsAppInviteMessage;
    return build({
      guestId: waGuest.id,
      greeting: waGuest.greeting,
      guestName: waGuest.guestName,
      eventTitle,
      coupleNames: eventCoupleNames,
      rsvpLink: guestRsvpUrl(siteUrl, waGuest.token),
      customIntroLine: inviteMessageIntro,
      customLineOverride: inviteMessageLineOverride,
    });
  }, [waGuest, eventTitle, eventCoupleNames, siteUrl, inviteMessageIntro, inviteMessageLineOverride, isReminder]);

  const guestIds = useMemo(() => guests.map((g) => g.id), [guests]);
  const emailEligibleIds = useMemo(() => guests.filter(hasEmail).map((g) => g.id), [guests]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  if (!open) {
    return null;
  }

  async function copyAllMessages() {
    const build = isReminder ? buildGuestRsvpReminderMessage : buildGuestWhatsAppInviteMessage;
    const bundles = sortedGuests.map((guest) => {
      const link = guestRsvpUrl(siteUrl, guest.token);
      const message = build({
        guestId: guest.id,
        greeting: guest.greeting,
        guestName: guest.guestName,
        eventTitle,
        coupleNames: eventCoupleNames,
        rsvpLink: link,
        customIntroLine: inviteMessageIntro,
        customLineOverride: inviteMessageLineOverride,
      });
      return `${guest.guestName}\n${message}`;
    });
    await navigator.clipboard.writeText(bundles.join("\n\n---\n\n"));
    setCopied("messages");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyAllLinks() {
    const lines = sortedGuests.map((g) => `${g.guestName}: ${guestRsvpUrl(siteUrl, g.token)}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied("links");
    setTimeout(() => setCopied(null), 2000);
  }

  function exportContacts() {
    const rows = [
      ["Guest Name", "Phone", "Email", "RSVP Link"],
      ...sortedGuests.map((g) => [
        g.guestName,
        g.phone ?? "",
        g.email ?? "",
        guestRsvpUrl(siteUrl, g.token),
      ]),
    ];
    downloadCsv(`${isReminder ? "reminder" : "invite"}-contacts-${eventId.slice(0, 8)}.csv`, rows);
  }

  function openNextWhatsApp() {
    if (!waGuest) return;
    const url = getWhatsAppInviteUrlForGuest(waGuest.phone, waMessage);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    const maxIdx = Math.max(0, waPhoneEligible.length - 1);
    setWaIndex((i) => Math.min(i + 1, maxIdx));
  }

  function sendEmails() {
    setEmailStatus(null);
    startTransition(async () => {
      if (isReminder) {
        const result = await sendBulkGuestReminderEmailsAction(eventId, emailEligibleIds);
        setEmailStatus(
          `Sent ${result.sent}. Skipped (no email): ${result.skippedMissingEmail}. Not eligible (not invited / already RSVP’d): ${result.skippedNotEligible}. Failed: ${result.failed}.`,
        );
      } else {
        const result = await sendBulkGuestInviteEmailsAction(eventId, emailEligibleIds);
        setEmailStatus(
          `Sent ${result.sent}. Skipped (no email): ${result.skippedMissingEmail}. Failed: ${result.failed}.`,
        );
      }
      refresh();
    });
  }

  function markSent(channel: "whatsapp" | "manual") {
    setMarkStatus(null);
    startTransition(async () => {
      if (isReminder) {
        const res = await recordGuestRemindersSentAction(eventId, guestIds, channel);
        setMarkStatus(`Recorded last reminder for ${res.updated} guest(s).`);
      } else {
        const res = await markGuestsInvitedAction(eventId, guestIds, channel);
        setMarkStatus(`Updated ${res.updated} guest(s).`);
      }
      refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffcf6] shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ebe4d6] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {isReminder ? "RSVP reminders" : "Send invites"}
            </p>
            <h2 className="font-display text-xl font-semibold text-zinc-900">{eventTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600">{scopeDescription}</p>
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
          {guests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-4 py-6 text-sm text-zinc-600">
              No guests in this scope. Adjust filters or add guests first.
            </p>
          ) : (
            <>
              <section className="rounded-2xl border border-[#e7dccb] bg-[#fffdfa] p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Recipients</h3>
                <p className="mt-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{summary.total}</span> selected
                  {summary.total === 1 ? " guest" : " guests"} ·{" "}
                  <span className="text-zinc-800">{summary.withPhone}</span> with phone on file ·{" "}
                  <span className="text-zinc-800">{waPhoneEligible.length}</span> with WhatsApp-ready numbers ·{" "}
                  <span className="text-zinc-800">{summary.withEmail}</span> with email ·{" "}
                  <span className="text-zinc-800">{summary.missing}</span> missing phone and email
                </p>
                {isReminder ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    Reminders are for guests who were already invited and have not RSVP’d yet. Ineligible guests are
                    skipped when sending email.
                  </p>
                ) : null}
                {!isReminder && summary.missing > 0 && summary.withPhone + summary.withEmail < summary.total ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Guests without contact info can still copy RSVP links; add a full international phone number
                    (country code, no leading 0) for direct WhatsApp click-to-chat.
                  </p>
                ) : null}
              </section>

              <section className="mt-4 rounded-2xl border border-[#e7dccb] bg-white p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Message preview</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {isReminder
                    ? guests.length > 1
                      ? "Sample reminder — each family gets their own greeting and RSVP link."
                      : "Your reminder text:"
                    : guests.length > 1
                      ? "Sample for one guest — each family gets their own greeting and RSVP link."
                      : "Your invite text:"}
                </p>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-[#ebe4d6] bg-[#fbf8f2] p-3 font-sans text-xs leading-relaxed text-zinc-800">
                  {sampleMessage || "—"}
                </pre>
              </section>

              <section className="mt-4">
                <h3 className="text-sm font-semibold text-zinc-900">WhatsApp</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {isReminder
                    ? "Warm reminder text per guest. Use “Open next” to send in order; each RSVP link is unique."
                    : "Primary channel — one personalized message per guest. Use “Open next” to send in order; each link is unique."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    disabled={!waGuest || isPending || waPhoneEligible.length === 0}
                    title={
                      waPhoneEligible.length === 0
                        ? "No guests have a WhatsApp-ready phone number (country code, no leading 0)."
                        : undefined
                    }
                    onClick={openNextWhatsApp}
                  >
                    <WhatsAppIcon className="h-4 w-4 text-white" />
                    Open next ({waGuest ? waStep + 1 : 0}/{waPhoneEligible.length})
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isPending || guests.length === 0}
                    onClick={() => markSent("whatsapp")}
                  >
                    {isReminder ? "Record reminder sent (WhatsApp)" : "Mark all as invited (WhatsApp)"}
                  </button>
                </div>
                {waPhoneEligible.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-800">
                    No guests in this scope have a WhatsApp-ready number. Use international format with country code (e.g.{" "}
                    <span className="font-mono">+65 9123 4567</span>) — no leading 0. You can still copy messages or RSVP
                    links below.
                  </p>
                ) : waGuest ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    Next: <span className="font-medium text-zinc-900">{waGuest.guestName}</span>
                    {hasPhone(waGuest) ? " · phone on file" : null}
                  </p>
                ) : null}
              </section>

              <section className="mt-4">
                <h3 className="text-sm font-semibold text-zinc-900">Email</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {isReminder
                    ? "Sends reminder emails only to eligible guests with an address. Others are skipped."
                    : "Sends only to guests with an email address. Others are skipped — not an error."}
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  disabled={emailEligibleIds.length === 0 || isPending}
                  title={emailEligibleIds.length === 0 ? "No guests in scope have email" : undefined}
                  onClick={sendEmails}
                >
                  {isReminder ? "Send reminder emails" : "Send email invites"} ({emailEligibleIds.length})
                </button>
                {emailStatus ? <p className="mt-2 text-xs text-zinc-600">{emailStatus}</p> : null}
              </section>

              <section className="mt-4">
                <h3 className="text-sm font-semibold text-zinc-900">Copy &amp; export</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" disabled={guests.length === 0} onClick={copyAllMessages}>
                    {copied === "messages"
                      ? "Copied!"
                      : isReminder
                        ? "Copy all reminder messages"
                        : "Copy all personalized messages"}
                  </button>
                  <button type="button" className="btn-secondary" disabled={guests.length === 0} onClick={copyAllLinks}>
                    {copied === "links" ? "Copied!" : "Copy name + RSVP links"}
                  </button>
                  <button type="button" className="btn-secondary" disabled={guests.length === 0} onClick={exportContacts}>
                    Export contacts (CSV)
                  </button>
                </div>
              </section>

              <section className="mt-4 rounded-2xl border border-[#e1d5c3] bg-[#f8f1e5] p-4">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {isReminder ? "Record offline reminders" : "Mark as sent"}
                </h3>
                <p className="mt-1 text-xs text-zinc-600">
                  {isReminder
                    ? "If you nudged guests outside the app (call, text, in person), record the last reminder time here."
                    : "If you sent invites outside the app, record it here so your list stays accurate."}
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  disabled={guests.length === 0 || isPending}
                  onClick={() => markSent("manual")}
                >
                  {isReminder ? "Record reminder sent (manual)" : "Mark all in scope as invited (manual)"}
                </button>
                {markStatus ? <p className="mt-2 text-xs text-zinc-700">{markStatus}</p> : null}
              </section>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-[#ebe4d6] px-5 py-3 sm:px-6">
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
