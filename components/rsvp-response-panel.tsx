"use client";

import { useState } from "react";
import { RsvpForm } from "@/components/rsvp-form";

const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

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
    <div className="invite-sheet w-full px-6 pt-8 pb-7 text-center sm:px-8">
      <div className="invite-rule" aria-hidden />
      <h2 className={`mt-5 text-[1.75rem] leading-tight text-[var(--inv-ink)] ${serif}`}>
        {isAttending ? "We'll see you there" : "Thank you for letting us know"}
      </h2>

      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-[#4a413a]">
        {isAttending ? (
          <>
            We&apos;re so glad you&apos;re coming.
            {typeof attendingCount === "number" && attendingCount > 0 ? (
              <span className="mt-1 block font-semibold text-[var(--inv-accent)] tabular-nums">
                {attendingCount === 1 ? "1 person confirmed." : `${attendingCount} people confirmed.`}
              </span>
            ) : null}
          </>
        ) : (
          "We'll miss you, and we completely understand."
        )}
      </p>

      <p className="mt-4 text-[13px] text-[var(--inv-muted)]">Reply sent {respondedAtLabel}</p>

      {hostMessage ? (
        <div className="mx-auto mt-6 max-w-sm border-t border-[var(--inv-rule)] pt-5 text-left">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--inv-muted)] uppercase">Your note</p>
          <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap text-[#4a413a]">{hostMessage}</p>
        </div>
      ) : null}

      {canEdit && !previewMode ? (
        <button type="button" onClick={() => setIsEditing(true)} className="invite-btn-quiet mt-6">
          Change my reply
        </button>
      ) : previewMode ? (
        <p className="mt-5 text-xs text-[var(--inv-muted)]">Preview only. Changing the reply is turned off.</p>
      ) : (
        <p className="mt-5 text-sm text-[var(--inv-muted)]">Replies have closed. To change your plans, please contact your hosts.</p>
      )}
    </div>
  );
}
