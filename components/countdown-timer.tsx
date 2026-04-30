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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const target = new Date(eventStartISO);
    if (isNaN(target.getTime())) return;
    setMounted(true);
    setTimeLeft(getTimeLeft(target));
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1_000);
    return () => clearInterval(id);
  }, [eventStartISO]);

  // SSR renders nothing — client hydrates without mismatch
  // Also hides gracefully once the event has passed
  if (!mounted || !timeLeft) return null;

  const units = [
    { label: "days", value: timeLeft.days },
    { label: "hrs", value: timeLeft.hours },
    { label: "min", value: timeLeft.minutes },
    { label: "sec", value: timeLeft.seconds },
  ];

  return (
    <div className="mx-auto max-w-xs">
      <p className="mb-4 text-center text-[0.52rem] font-semibold uppercase tracking-[0.36em] text-zinc-400">
        Event begins in
      </p>
      <div className="flex items-center justify-center gap-1">
        {units.map(({ label, value }, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-[1.1rem] border border-[#e2d5c0] bg-[#fbf8f2] shadow-[0_1px_4px_rgba(63,47,31,0.07),inset_0_1px_0_rgba(255,255,255,0.85)] ${serif}`}
              >
                <span
                  key={`${label}-${value}`}
                  className={`text-[2rem] font-semibold leading-none tabular-nums text-[#1d1208] ${label === "sec" ? "countdown-tick" : ""}`}
                  aria-label={`${value} ${label}`}
                >
                  {pad(value)}
                </span>
              </div>
              <span className="mt-1.5 text-[0.44rem] font-semibold uppercase tracking-[0.26em] text-zinc-400">
                {label}
              </span>
            </div>
            {i < units.length - 1 && (
              <span
                className="mb-6 select-none px-0.5 text-sm font-light text-[#c8b78e]"
                aria-hidden
              >
                ·
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
