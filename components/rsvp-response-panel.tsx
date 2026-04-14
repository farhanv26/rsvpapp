"use client";

import { useState } from "react";
import { RsvpForm } from "@/components/rsvp-form";

type Props = {
  token: string;
  maxGuests: number;
  respondedAtLabel: string;
  attending: boolean | null;
  attendingCount: number | null;
  canEdit: boolean;
};

export function RsvpResponsePanel({
  token,
  maxGuests,
  respondedAtLabel,
  attending,
  attendingCount,
  canEdit,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <RsvpForm
        token={token}
        maxGuests={maxGuests}
        isLocked={false}
        initialAttending={attending ? "yes" : "no"}
        onCancelEdit={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-6 py-9 text-center shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)]">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">RSVP received</p>
      <h2 className="mt-3 text-2xl font-semibold text-zinc-900 sm:text-3xl">Thank you for your response</h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
        {attending ? (
          <>
            We look forward to celebrating with you.
            {typeof attendingCount === "number" ? ` You confirmed ${attendingCount} guest(s).` : ""}
          </>
        ) : (
          <>We&apos;re sorry you will not be able to attend, but we completely understand.</>
        )}
      </p>
      <p className="mt-6 text-xs uppercase tracking-[0.16em] text-zinc-500">Recorded {respondedAtLabel}</p>
      {canEdit ? (
        <button type="button" onClick={() => setIsEditing(true)} className="btn-secondary mt-5">
          Edit RSVP
        </button>
      ) : (
        <p className="mt-5 text-xs uppercase tracking-[0.16em] text-zinc-500">Editing is closed after the RSVP deadline</p>
      )}
    </div>
  );
}
