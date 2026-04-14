"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

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

function parseIsoToDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatIsoFromDate(value: Date) {
  const yyyy = String(value.getFullYear());
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function displayDate(value: string) {
  const asDate = parseIsoToDate(value);
  if (!asDate) return "Select date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(asDate);
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
  const [openPicker, setOpenPicker] = useState<"eventDate" | "rsvpDeadline" | null>(null);
  const eventDateRef = useRef<HTMLInputElement | null>(null);
  const todayDate = useMemo(() => parseIsoToDate(today), [today]);
  const selectedEventDate = useMemo(() => parseIsoToDate(eventDate), [eventDate]);
  const selectedDeadlineDate = useMemo(() => parseIsoToDate(rsvpDeadline), [rsvpDeadline]);
  const eventDateDisabled = todayDate ? { before: todayDate } : undefined;
  const deadlineDisabled =
    todayDate || selectedEventDate
      ? {
          ...(todayDate ? { before: todayDate } : {}),
          ...(selectedEventDate ? { after: selectedEventDate } : {}),
        }
      : undefined;

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
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-date-picker-root]")) {
        setOpenPicker(null);
      }
    }
    if (!openPicker) return;
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [openPicker]);

  useEffect(() => {
    if (!eventDate || isDeadlineTouched || rsvpDeadline || eventDate < today) return;
    const suggestion = minusDays(eventDate, 3);
    if (suggestion && suggestion >= today && suggestion <= eventDate) {
      setRsvpDeadline(suggestion);
    }
  }, [eventDate, isDeadlineTouched, rsvpDeadline, today]);

  return (
    <>
      <div className="sm:col-span-2">
        <p className="section-title">Schedule</p>
        <h3 className="mt-2 text-lg font-semibold text-zinc-900">Date, time, and RSVP deadline</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Set when your event happens and when guests should respond.
        </p>
      </div>

      <div className="space-y-2" data-date-picker-root>
        <label htmlFor="eventDate" className="block text-sm font-medium">
          Event date
        </label>
        <input ref={eventDateRef} id="eventDate" name="eventDate" type="hidden" value={eventDate} required />
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPicker((v) => (v === "eventDate" ? null : "eventDate"))}
            className={`input-luxe mt-0 flex w-full items-center justify-between text-left ${eventDate ? "text-zinc-900" : "text-zinc-500"} ${eventDateError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
          >
            <span>{displayDate(eventDate)}</span>
            <span aria-hidden>📅</span>
          </button>
          {openPicker === "eventDate" ? (
            <div className="absolute z-30 mt-2 rounded-2xl border border-[#e3d8c7] bg-[#fffdfa] p-3 shadow-xl">
              <DayPicker
                mode="single"
                selected={selectedEventDate}
                onSelect={(value) => {
                  if (!value) return;
                  const iso = formatIsoFromDate(value);
                  setEventDate(iso);
                  setOpenPicker(null);
                }}
                disabled={eventDateDisabled}
              />
            </div>
          ) : null}
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

      <div className="space-y-2" data-date-picker-root>
        <label htmlFor="rsvpDeadline" className="mb-2 block text-sm font-medium">
          RSVP deadline
        </label>
        <input id="rsvpDeadline" name="rsvpDeadline" type="hidden" value={rsvpDeadline} required />
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (!eventDate) return;
              setOpenPicker((v) => (v === "rsvpDeadline" ? null : "rsvpDeadline"));
            }}
            disabled={!eventDate}
            className={`input-luxe mt-0 flex w-full items-center justify-between text-left ${rsvpDeadline ? "text-zinc-900" : "text-zinc-500"} disabled:cursor-not-allowed disabled:bg-zinc-100 ${
              deadlineError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""
            }`}
          >
            <span>{displayDate(rsvpDeadline)}</span>
            <span aria-hidden>📅</span>
          </button>
          {openPicker === "rsvpDeadline" && eventDate ? (
            <div className="absolute z-30 mt-2 rounded-2xl border border-[#e3d8c7] bg-[#fffdfa] p-3 shadow-xl">
              <DayPicker
                mode="single"
                selected={selectedDeadlineDate}
                onSelect={(value) => {
                  if (!value) return;
                  setIsDeadlineTouched(true);
                  setRsvpDeadline(formatIsoFromDate(value));
                  setOpenPicker(null);
                }}
                disabled={deadlineDisabled}
              />
            </div>
          ) : null}
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
