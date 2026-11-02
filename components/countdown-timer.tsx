"use client";

import { useEffect, useState } from "react";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

/**
 * eventStartISO — "YYYY-MM-DDTHH:MM:SS" with NO timezone suffix.
 * Parsed as the client's local timezone so every guest counts down to
 * the event's wall-clock start time (e.g. 18:00 shows 18:00 local).
 */
export function CountdownTimer({ eventStartISO }: { eventStartISO: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const target = new Date(eventStartISO);
    if (isNaN(target.getTime())) return;
    const update = () => setTimeLeft(getTimeLeft(target));
    const initial = setTimeout(update, 0);
    const id = setInterval(update, 1_000);
    return () => { clearTimeout(initial); clearInterval(id); };
  }, [eventStartISO]);

  // SSR renders nothing — client hydrates without mismatch
  // Also hides gracefully once the event has passed
  if (!timeLeft) return null;

  const units = [
    { label: "days", value: timeLeft.days },
    { label: "hrs", value: timeLeft.hours },
    { label: "min", value: timeLeft.minutes },
    { label: "sec", value: timeLeft.seconds },
  ];

  return (
    <div className="mx-auto max-w-sm py-3 text-center">
      <p className="sr-only">Time until the event begins</p>
      <div className="grid grid-cols-4 divide-x divide-[var(--inv-rule,#e3d9c8)]">
        {units.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center px-2">
            <span
              key={`${label}-${value}`}
              className={`text-[2.1rem] leading-none tabular-nums text-[var(--inv-ink,#221b17)] ${serif}`}
              aria-label={`${value} ${label}`}
            >
              {pad(value)}
            </span>
            <span className="mt-1 text-xs text-[var(--inv-muted,#6b6157)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
