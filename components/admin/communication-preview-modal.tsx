"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getGuestCommunicationPreviewAction,
  type GuestCommunicationPreviewPayload,
} from "@/app/admin/events/actions";
import { formatGuestPhoneLabel } from "@/lib/phone";
import { getWhatsAppInviteUrlForGuest, WHATSAPP_PHONE_INVALID_INLINE } from "@/lib/whatsapp";

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

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  guestId: string | null;
  /** When opening from bulk selection, show that this is one sample among many. */
  bulkSampleNote?: boolean;
  selectedCount?: number;
  /** Opens communication history for this guest (closes preview). Row-level history was removed for clarity. */
  onViewCommunicationHistory?: () => void;
};

export function CommunicationPreviewModal({
  open,
  onClose,
  eventId,
  guestId,
  bulkSampleNote,
  selectedCount,
  onViewCommunicationHistory,
}: Props) {
  const [tab, setTab] = useState<"whatsapp" | "email">("whatsapp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GuestCommunicationPreviewPayload | null>(null);
  const [copied, setCopied] = useState<"wa" | null>(null);

  const load = useCallback(async () => {
    if (!guestId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getGuestCommunicationPreviewAction(eventId, guestId);
      if (!res.ok) {
        setError(res.error ?? "Could not load preview.");
        setPreview(null);
        return;
      }
      setPreview(res.preview);
    } catch {
      setError("Could not load preview.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, guestId]);

  useEffect(() => {
    if (open && guestId) {
      void load();
    } else if (!open) {
      setPreview(null);
      setError(null);
      setCopied(null);
    }
  }, [open, guestId, load]);

  useEffect(() => {
    if (preview && !preview.hasEmail && tab === "email") {
      setTab("whatsapp");
    }
  }, [preview, tab]);

  if (!open) {
    return null;
  }

  const whatsappHref =
    preview && preview.whatsappMessage
      ? getWhatsAppInviteUrlForGuest(preview.phone, preview.whatsappMessage, preview.phoneCountryCode)
      : null;

  const phoneLabel =
    preview && (preview.phone?.trim() || preview.phoneCountryCode?.trim())
      ? formatGuestPhoneLabel({
          phone: preview.phone,
          phoneCountryCode: preview.phoneCountryCode,
        })
      : null;
  const emailLabel = preview?.email?.trim() ? preview.email : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fffdfa] shadow-xl">
        <div className="border-b border-[#efe4d4] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Message preview</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">Simulate communication</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Same wording as Copy invite / Send email — not a sample template.
              </p>
            </div>
            <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={onClose}>
              Close
            </button>
          </div>
          {bulkSampleNote && (selectedCount ?? 0) > 1 ? (
            <p className="mt-3 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs text-sky-950">
              Showing preview for <span className="font-semibold">{preview?.guestName ?? "…"}</span>. Each selected guest
              gets their own greeting, name, and RSVP link.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-600">Loading preview…</p>
          ) : error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
          ) : preview ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-950">
                  <WhatsAppIcon className="h-3.5 w-3.5 text-[#128C7E]" />
                  WhatsApp ready
                </span>
                {preview.whatsappDirectAvailable ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                    Direct chat (phone on file)
                  </span>
                ) : phoneLabel ? (
                  <span className="rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-xs text-amber-950">
                    {WHATSAPP_PHONE_INVALID_INLINE}
                  </span>
                ) : (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                    No phone on file
                  </span>
                )}
                {preview.hasEmail ? (
                  <span className="rounded-full border border-sky-200/90 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950">
                    Email preview available
                  </span>
                ) : (
                  <span className="rounded-full border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 text-xs text-zinc-600">
                    No email on file
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Guest</p>
                <p className="mt-1 font-medium text-zinc-900">{preview.guestName}</p>
                <p className="mt-1 text-sm text-zinc-700">
                  <span className="text-zinc-500">Greeting:</span> {preview.greeting}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                  <span>{phoneLabel ? `Phone: ${phoneLabel}` : "Phone: —"}</span>
                  <span>{emailLabel ? `Email: ${emailLabel}` : "Email: —"}</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Event</p>
                <p className="mt-1 font-medium text-zinc-900">{preview.eventTitle}</p>
                {preview.coupleNames?.trim() ? (
                  <p className="mt-1 text-sm text-zinc-700">Couple: {preview.coupleNames}</p>
                ) : null}
                {preview.eventSubtitle?.trim() ? (
                  <p className="mt-1 text-sm text-zinc-600">{preview.eventSubtitle}</p>
                ) : null}
              </div>

              <div className="rounded-xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Message structure</p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                  <li>
                    <span className="text-zinc-500">Greeting:</span> {preview.greeting} {preview.guestName},
                  </li>
                  <li>
                    <span className="text-zinc-500">Intro:</span> {preview.inviteIntroLine}
                  </li>
                  <li>
                    <span className="text-zinc-500">Randomized line:</span> {preview.randomizedLine}
                  </li>
                  <li className="break-all">
                    <span className="text-zinc-500">RSVP link:</span> {preview.rsvpLink}
                  </li>
                </ul>
              </div>

              <div className="flex gap-1 rounded-xl border border-[#e7dccb] bg-[#f4f0e8] p-1">
                <button
                  type="button"
                  onClick={() => setTab("whatsapp")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    tab === "whatsapp"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setTab("email")}
                  disabled={!preview.hasEmail}
                  className={`flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                    tab === "email"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Email
                </button>
              </div>

              {tab === "whatsapp" ? (
                <div className="space-y-3">
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-[#e7dccb] bg-white px-4 py-3 font-sans text-sm leading-relaxed text-zinc-800">
                    {preview.whatsappMessage}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(preview.whatsappMessage);
                          setCopied("wa");
                          setTimeout(() => setCopied(null), 1800);
                        } catch {
                          setCopied(null);
                        }
                      }}
                    >
                      {copied === "wa" ? "Copied!" : "Copy message"}
                    </button>
                    {whatsappHref ? (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary inline-flex items-center gap-2 text-sm"
                      >
                        <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                        Open WhatsApp
                      </a>
                    ) : (
                      <span
                        className="btn-secondary inline-flex cursor-not-allowed items-center gap-2 text-sm opacity-50"
                        title={phoneLabel ? WHATSAPP_PHONE_INVALID_INLINE : "Add a phone number for WhatsApp."}
                        aria-disabled="true"
                      >
                        <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
                        {phoneLabel ? "WhatsApp unavailable" : "WhatsApp (add phone)"}
                      </span>
                    )}
                  </div>
                </div>
              ) : preview.hasEmail ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Subject</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{preview.emailSubject}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Body</p>
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-[#e7dccb] bg-white px-4 py-3 font-sans text-sm leading-relaxed text-zinc-800">
                      {preview.emailBody}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-600">
                  This guest does not have an email address on file. Add an email to the guest record to send an invite
                  by email.
                </p>
              )}
            </div>
          ) : null}
        </div>
        {onViewCommunicationHistory ? (
          <div className="shrink-0 border-t border-[#efe4d4] px-5 py-3">
            <button
              type="button"
              className="text-xs font-medium text-[#6a5434] underline-offset-2 hover:text-zinc-900 hover:underline"
              onClick={() => {
                onViewCommunicationHistory();
                onClose();
              }}
            >
              View communication history
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
