"use client";

import { useState } from "react";
import { RsvpForm } from "@/components/rsvp-form";

const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";
const script = "font-[family-name:var(--font-wedding-script),cursive]";

type Props = {
  token: string;
  maxGuests: number;
  respondedAtLabel: string;
  attending: boolean | null;
  attendingCount: number | null;
  hostMessage: string | null;
  canEdit: boolean;
  previewMode?: boolean;
};

export function RsvpResponsePanel({
  token,
  maxGuests,
  respondedAtLabel,
  attending,
  attendingCount,
  hostMessage,
  canEdit,
  previewMode = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <RsvpForm
        token={token}
        maxGuests={maxGuests}
        isLocked={false}
        previewMode={previewMode}
        initialAttending={attending ? "yes" : "no"}
        initialAttendingCount={attendingCount}
        initialHostMessage={hostMessage}
        onCancelEdit={() => setIsEditing(false)}
      />
    );
  }

  const isAttending = attending === true;

  return (
    <div
      className="w-full rounded-3xl border px-6 py-9 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]"
      style={
        isAttending
          ? {
              background: "linear-gradient(160deg, #f0fdf6 0%, #fffdfa 55%)",
              borderColor: "#a7f3d0",
            }
          : {
              background: "#fffdfa",
              borderColor: "#e7dccb",
            }
      }
    >
      {/* Status icon */}
      {isAttending ? (
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-emerald-600" aria-hidden>
            <path d="M4 12.5l5 5L20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-50">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-zinc-400" aria-hidden>
            <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      <p className={`text-[0.6rem] font-semibold uppercase tracking-[0.26em] ${isAttending ? "text-emerald-600" : "text-zinc-400"}`}>
        {isAttending ? "RSVP Confirmed" : "RSVP received"}
      </p>

      <h2 className={`mt-2 text-[1.65rem] leading-tight text-zinc-900 ${serif}`}>
        {isAttending ? "See you there!" : "Thank you for letting us know"}
      </h2>

      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
        {isAttending ? (
          <>
            We&apos;re delighted you&apos;ll be joining us.
            {typeof attendingCount === "number" && attendingCount > 0
              ? ` ${attendingCount} ${attendingCount === 1 ? "guest" : "guests"} confirmed.`
              : ""}
          </>
        ) : (
          "We're sorry you won't be able to make it, but we completely understand."
        )}
      </p>

      <p className="mt-5 text-[0.65rem] uppercase tracking-[0.18em] text-zinc-400">
        Recorded {respondedAtLabel}
      </p>

      {/* Host message display */}
      {hostMessage ? (
        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-4 text-left">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-zinc-400">Your message to host</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{hostMessage}</p>
        </div>
      ) : null}

      {/* Edit / closed state */}
      {canEdit && !previewMode ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="btn-secondary mt-6"
        >
          Edit RSVP
        </button>
      ) : previewMode ? (
        <p className="mt-5 text-xs text-zinc-400">Preview mode — editing RSVP is disabled.</p>
      ) : (
        <p className="mt-5 text-xs uppercase tracking-[0.16em] text-zinc-400">
          Editing is closed after the RSVP deadline
        </p>
      )}
    </div>
  );
}
