"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  eventDateDefault?: string;
  rsvpDeadlineDefault?: string;
};

function todayLocalIso() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function minusDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - days);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EventSchedulingFields({ eventDateDefault = "", rsvpDeadlineDefault = "" }: Props) {
  const today = useMemo(() => todayLocalIso(), []);
  const [eventDate, setEventDate] = useState(eventDateDefault);
  const [rsvpDeadline, setRsvpDeadline] = useState(rsvpDeadlineDefault);
  const [isDeadlineTouched, setIsDeadlineTouched] = useState(Boolean(rsvpDeadlineDefault));
  const eventDateRef = useRef<HTMLInputElement | null>(null);

  const eventDateError = eventDate && eventDate < today ? "Event date cannot be in the past." : null;
  const deadlinePastError = rsvpDeadline && rsvpDeadline < today ? "RSVP deadline cannot be in the past." : null;
  const deadlineNeedsEventDateError =
    rsvpDeadline && !eventDate ? "Set an event date before adding an RSVP deadline." : null;
  const deadlineAfterEventError =
    rsvpDeadline && eventDate && rsvpDeadline > eventDate
      ? "RSVP deadline must be on or before the event date."
      : null;
  const deadlineError = deadlinePastError || deadlineNeedsEventDateError || deadlineAfterEventError || null;
  const hasError = Boolean(eventDateError || deadlineError);

  useEffect(() => {
    const form = eventDateRef.current?.form;
    if (!form) return;
    const submitButtons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'));
    submitButtons.forEach((button) => {
      button.disabled = hasError;
    });
  }, [hasError]);

  useEffect(() => {
    if (!eventDate || isDeadlineTouched || rsvpDeadline) return;
    const suggestion = minusDays(eventDate, 3);
    if (suggestion && suggestion >= today && suggestion <= eventDate) {
      setRsvpDeadline(suggestion);
    }
  }, [eventDate, isDeadlineTouched, rsvpDeadline, today]);

  return (
    <>
      <div>
        <label htmlFor="eventDate" className="mb-2 block text-sm font-medium">
          Event date (optional)
        </label>
        <input
          ref={eventDateRef}
          id="eventDate"
          name="eventDate"
          type="date"
          min={today}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className={`input-luxe mt-0 ${eventDateError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
        />
        {eventDateError ? <p className="mt-2 text-sm text-red-700">{eventDateError}</p> : null}
      </div>

      <div>
        <label htmlFor="rsvpDeadline" className="mb-2 block text-sm font-medium">
          RSVP deadline (optional)
        </label>
        <input
          id="rsvpDeadline"
          name="rsvpDeadline"
          type="date"
          min={today}
          max={eventDate || undefined}
          disabled={!eventDate}
          value={rsvpDeadline}
          onChange={(e) => {
            setIsDeadlineTouched(true);
            setRsvpDeadline(e.target.value);
          }}
          className={`input-luxe mt-0 disabled:cursor-not-allowed disabled:bg-zinc-100 ${
            deadlineError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""
          }`}
        />
        {!eventDate ? <p className="mt-2 text-xs text-zinc-500">Select an event date to enable RSVP deadline.</p> : null}
        {deadlineError ? <p className="mt-2 text-sm text-red-700">{deadlineError}</p> : null}
      </div>
    </>
  );
}
