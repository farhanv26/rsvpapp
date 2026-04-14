"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  eventDateDefault?: string;
  rsvpDeadlineDefault?: string;
  eventTimeDefault?: string;
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

export function EventSchedulingFields({
  eventDateDefault = "",
  rsvpDeadlineDefault = "",
  eventTimeDefault = "",
}: Props) {
  const today = useMemo(() => todayLocalIso(), []);
  const [eventDate, setEventDate] = useState(eventDateDefault);
  const [rsvpDeadline, setRsvpDeadline] = useState(rsvpDeadlineDefault);
  const [eventTime, setEventTime] = useState(eventTimeDefault);
  const [isDeadlineTouched, setIsDeadlineTouched] = useState(Boolean(rsvpDeadlineDefault));
  const eventDateRef = useRef<HTMLInputElement | null>(null);

  const eventDateRequiredError = !eventDate ? "Event date is required." : null;
  const eventDatePastError = eventDate && eventDate < today ? "Event date cannot be in the past." : null;
  const eventDateError = eventDateRequiredError || eventDatePastError || null;
  const eventTimeError = !eventTime ? "Event time is required." : null;
  const deadlineRequiredError = !rsvpDeadline ? "RSVP deadline is required." : null;
  const deadlinePastError = rsvpDeadline && rsvpDeadline < today ? "RSVP deadline cannot be in the past." : null;
  const deadlineAfterEventError =
    rsvpDeadline && eventDate && rsvpDeadline > eventDate
      ? "RSVP deadline must be on or before the event date."
      : null;
  const deadlineError = deadlineRequiredError || deadlinePastError || deadlineAfterEventError || null;
  const hasError = Boolean(eventDateError || deadlineError || eventTimeError);

  useEffect(() => {
    const form = eventDateRef.current?.form;
    if (!form) return;
    const submitButtons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'));
    submitButtons.forEach((button) => {
      button.disabled = hasError;
    });
  }, [hasError]);

  useEffect(() => {
    if (!eventDate || isDeadlineTouched || rsvpDeadline || eventDate < today) return;
    const suggestion = minusDays(eventDate, 3);
    if (suggestion && suggestion >= today && suggestion <= eventDate) {
      setRsvpDeadline(suggestion);
    }
  }, [eventDate, isDeadlineTouched, rsvpDeadline, today]);

  return (
    <>
      <div>
        <label htmlFor="eventDate" className="mb-2 block text-sm font-medium">
          Event date
        </label>
        <div className="relative">
          <input
            ref={eventDateRef}
            id="eventDate"
            name="eventDate"
            type="date"
            min={today}
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={`input-luxe mt-0 pr-10 ${eventDateError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">📅</span>
        </div>
        {eventDateError ? <p className="mt-2 text-sm text-red-700">{eventDateError}</p> : null}
      </div>

      <div>
        <label htmlFor="eventTime" className="mb-2 block text-sm font-medium">
          Event time
        </label>
        <div className="relative">
          <input
            id="eventTime"
            name="eventTime"
            type="time"
            required
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            className={`input-luxe mt-0 pr-10 ${eventTimeError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">🕒</span>
        </div>
        {eventTimeError ? <p className="mt-2 text-sm text-red-700">{eventTimeError}</p> : null}
      </div>

      <div>
        <label htmlFor="rsvpDeadline" className="mb-2 block text-sm font-medium">
          RSVP deadline
        </label>
        <div className="relative">
          <input
            id="rsvpDeadline"
            name="rsvpDeadline"
            type="date"
            min={today}
            max={eventDate || undefined}
            required
            disabled={!eventDate}
            value={rsvpDeadline}
            onChange={(e) => {
              setIsDeadlineTouched(true);
              setRsvpDeadline(e.target.value);
            }}
            className={`input-luxe mt-0 pr-10 disabled:cursor-not-allowed disabled:bg-zinc-100 ${
              deadlineError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""
            }`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">📅</span>
        </div>
        {!eventDate ? (
          <p className="mt-2 text-xs text-zinc-500">
            Select an event date first, then choose any RSVP deadline from today through the event day.
          </p>
        ) : null}
        {deadlineError ? <p className="mt-2 text-sm text-red-700">{deadlineError}</p> : null}
      </div>
    </>
  );
}
