"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { Matcher } from "react-day-picker";

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

function displayTime(value: string) {
  if (!value) return "Select time";
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "Select time";
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function normalizeTimeValue(value: string) {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const [timePart] = value.split(" ");
  if (/^\d{2}:\d{2}$/.test(timePart)) return timePart;
  return "";
}

function parseTimeParts(value: string) {
  const normalized = normalizeTimeValue(value);
  if (!normalized) {
    return { hour12: "6", minute: "00", period: "PM" as "AM" | "PM" };
  }
  const [hh, mm] = normalized.split(":").map(Number);
  const period: "AM" | "PM" = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return { hour12: String(hour12), minute: String(mm).padStart(2, "0"), period };
}

function to24HourTime(hour12: string, minute: string, period: "AM" | "PM") {
  const parsedHour = Number(hour12);
  const parsedMinute = Number(minute);
  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
    return "";
  }
  let hour24 = parsedHour % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`;
}

const SCHEDULE_MINUTES = ["00", "15", "30", "45"];
const SCHEDULE_HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function EventSchedulingFields({
  eventDateDefault = "",
  rsvpDeadlineDefault = "",
  eventTimeDefault = "",
}: Props) {
  const today = useMemo(() => todayLocalIso(), []);
  const [eventDate, setEventDate] = useState(eventDateDefault);
  const [rsvpDeadline, setRsvpDeadline] = useState(rsvpDeadlineDefault);
  const [eventTime, setEventTime] = useState(normalizeTimeValue(eventTimeDefault));
  const [isDeadlineTouched, setIsDeadlineTouched] = useState(Boolean(rsvpDeadlineDefault));
  const [openPicker, setOpenPicker] = useState<"eventDate" | "eventTime" | "rsvpDeadline" | null>(null);
  const eventDateRef = useRef<HTMLInputElement | null>(null);
  const timeParts = useMemo(() => parseTimeParts(eventTime), [eventTime]);
  const [timeHour, setTimeHour] = useState(timeParts.hour12);
  const [timeMinute, setTimeMinute] = useState(timeParts.minute);
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">(timeParts.period);
  const todayDate = useMemo(() => parseIsoToDate(today), [today]);
  const selectedEventDate = useMemo(() => parseIsoToDate(eventDate), [eventDate]);
  const selectedDeadlineDate = useMemo(() => parseIsoToDate(rsvpDeadline), [rsvpDeadline]);
  const eventDateDisabled: Matcher | undefined = todayDate ? { before: todayDate } : undefined;
  const deadlineDisabled: Matcher | undefined = useMemo(() => {
    if (todayDate && selectedEventDate) {
      return { before: todayDate, after: selectedEventDate };
    }
    if (todayDate) {
      return { before: todayDate };
    }
    if (selectedEventDate) {
      return { after: selectedEventDate };
    }
    return undefined;
  }, [todayDate, selectedEventDate]);

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
    if (openPicker !== "eventTime") return;
    const parsed = parseTimeParts(eventTime);
    setTimeHour(parsed.hour12);
    setTimeMinute(parsed.minute);
    setTimePeriod(parsed.period);
  }, [openPicker, eventTime]);

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
          Set ceremony timing with a clear RSVP cutoff for invited families.
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
            <span aria-hidden className="text-zinc-500">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3 8.5h14M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
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

      <div className="space-y-2" data-date-picker-root>
        <label htmlFor="eventTime" className="mb-2 block text-sm font-medium">
          Event time
        </label>
        <input id="eventTime" name="eventTime" type="hidden" required value={eventTime} />
        <div className="relative">
          <button
            id="eventTime"
            type="button"
            onClick={() => setOpenPicker((v) => (v === "eventTime" ? null : "eventTime"))}
            className={`input-luxe mt-0 pr-10 ${eventTimeError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
          >
            <span className={eventTime ? "text-zinc-900" : "text-zinc-500"}>{displayTime(eventTime)}</span>
            <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 6.8v3.6l2.4 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          {openPicker === "eventTime" ? (
            <div className="absolute z-30 mt-2 w-full min-w-[16rem] rounded-2xl border border-[#e3d8c7] bg-[#fffdfa] p-3 shadow-xl">
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Hour
                  <select
                    value={timeHour}
                    onChange={(e) => setTimeHour(e.target.value)}
                    className="input-luxe mt-1 h-11 py-2"
                  >
                    {SCHEDULE_HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Minute
                  <select
                    value={timeMinute}
                    onChange={(e) => setTimeMinute(e.target.value)}
                    className="input-luxe mt-1 h-11 py-2"
                  >
                    {SCHEDULE_MINUTES.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Period
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value as "AM" | "PM")}
                    className="input-luxe mt-1 h-11 py-2"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#eee4d4] pt-3">
                <p className="text-xs text-zinc-500">15-minute increments for ceremony planning.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenPicker(null)}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = to24HourTime(timeHour, timeMinute, timePeriod);
                      setEventTime(next);
                      setOpenPicker(null);
                    }}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-zinc-500">Use local time for the ceremony (for example, 6:30 PM).</p>
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
            <span aria-hidden className="text-zinc-500">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3 8.5h14M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
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
