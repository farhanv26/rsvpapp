"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/admin/ui/dialog";
import QRCode from "qrcode";
import {
  buildGuestWhatsAppInviteMessage,
  getWhatsAppInviteUrlForGuest,
  WHATSAPP_PHONE_HELPER_TEXT,
  WHATSAPP_PHONE_INVALID_INLINE,
} from "@/lib/whatsapp";
import { buildAbsoluteUrl } from "@/lib/utils";

type GuestForShare = {
  id: string;
  guestName: string;
  token: string;
  greeting?: string | null;
  phone?: string | null;
  phoneCountryCode?: string | null;
};

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function EventRsvpShare({
  eventTitle,
  eventCoupleNames,
  inviteMessageIntro,
  inviteMessageLineOverride,
  guests,
  triggerClassName,
}: {
  eventTitle: string;
  eventCoupleNames?: string | null;
  inviteMessageIntro?: string | null;
  inviteMessageLineOverride?: string | null;
  guests: GuestForShare[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string>(guests[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const selected = useMemo(
    () => guests.find((g) => g.id === selectedGuestId) ?? guests[0] ?? null,
    [guests, selectedGuestId],
  );

  const link = useMemo(() => {
    if (!selected) return "";
    return buildAbsoluteUrl(`/rsvp/${selected.token}`);
  }, [selected]);
  const inviteMessage = useMemo(() => {
    if (!selected || !link) return "";
    return buildGuestWhatsAppInviteMessage({
      guestId: selected.id,
      greeting: selected.greeting,
      guestName: selected.guestName,
      eventTitle,
      coupleNames: eventCoupleNames,
      rsvpLink: link,
      customIntroLine: inviteMessageIntro,
      customLineOverride: inviteMessageLineOverride,
    });
  }, [eventTitle, eventCoupleNames, link, selected, inviteMessageIntro, inviteMessageLineOverride]);

  const whatsappDirectUrl = useMemo(
    () =>
      inviteMessage && selected
        ? getWhatsAppInviteUrlForGuest(selected.phone, inviteMessage, selected.phoneCountryCode)
        : null,
    [inviteMessage, selected],
  );

  useEffect(() => {
    if (!open) return;
    if (!link) return;
    QRCode.toDataURL(link, {
      width: 560,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1d1b18", light: "#fffcf6" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((e: unknown) => setQrError(e instanceof Error ? e.message : "Could not generate QR code."));
  }, [open, link]);

  if (guests.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={["btn-secondary", triggerClassName].filter(Boolean).join(" ")}
        onClick={() => {
          setQrDataUrl(null);
          setQrError(null);
          setOpen(true);
        }}
      >
        Share one link
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Share one invitation" description={eventTitle}>
        <div className="space-y-4">
          <label className="form-label">
            Household
            <select className="input-luxe" value={selectedGuestId} onChange={(e) => setSelectedGuestId(e.target.value)}>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.guestName}
                </option>
              ))}
            </select>
          </label>
          <p className="break-all rounded-lg bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                try {
                  await copyText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                try {
                  await copyText(inviteMessage);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  setCopied(false);
                }
              }}
            >
              Copy message
            </button>
            {whatsappDirectUrl ? (
              <a href={whatsappDirectUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                <WhatsAppIcon />
                Open WhatsApp
              </a>
            ) : (
              <span
                className="btn-secondary cursor-not-allowed opacity-50"
                aria-disabled="true"
                title={
                  selected?.phone?.trim()
                    ? WHATSAPP_PHONE_INVALID_INLINE + ". " + WHATSAPP_PHONE_HELPER_TEXT
                    : "Add a phone number for WhatsApp. " + WHATSAPP_PHONE_HELPER_TEXT
                }
              >
                <WhatsAppIcon />
                {selected?.phone?.trim() ? "Number not valid for WhatsApp" : "No phone number"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border-soft)] pt-4">
            {qrError ? <p className="text-sm text-[var(--danger)]">{qrError}</p> : null}
            {!qrError && !qrDataUrl ? <p className="text-sm text-[var(--muted-text)]">Making QR code…</p> : null}
            {qrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
                <img src={qrDataUrl} alt={`QR code for ${selected?.guestName ?? "this household"}'s invitation`} className="h-40 w-40 rounded-lg border border-[var(--border-soft)]" />
                <div className="flex flex-col gap-2">
                  <button type="button" className="btn-secondary" onClick={() => downloadDataUrl(`rsvp-qr-${selected?.guestName ?? "guest"}.png`, qrDataUrl)}>
                    Download QR code
                  </button>
                  <a href={link} target="_blank" rel="noreferrer" className="btn-ghost">
                    Open invitation
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </Dialog>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-4 w-4 text-[#128C7E]" aria-hidden="true">
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

