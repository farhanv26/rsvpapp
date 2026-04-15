"use client";

import { SafeEventImage } from "@/components/safe-event-image";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Browser-safe image URL from getSafeImageSrc, or null if none. */
  safeSrc: string | null;
  /** Full line e.g. "Using: 2 Guest Card" */
  usingLine: string;
  guestName: string;
};

export function GuestInviteCardPreviewModal({ open, onClose, safeSrc, usingLine, guestName }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="invite-card-preview-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e7dccb] bg-[#fffdfa] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="invite-card-preview-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Invite card preview
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{guestName}</p>
            <p className="mt-2 text-sm text-zinc-700">{usingLine}</p>
          </div>
          <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#e7dccb] bg-[#fbf8f2]">
          {safeSrc ? (
            <div className="relative h-80 w-full sm:h-[28rem]">
              <SafeEventImage
                src={safeSrc}
                alt=""
                fill
                className="object-contain object-center"
                fallbackLabel="Invitation image unavailable"
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-zinc-500">
              No invitation image is available for this variant.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
