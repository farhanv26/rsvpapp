"use client";

import { useState, useTransition } from "react";
import { submitRsvpAction } from "@/app/rsvp/[token]/actions";

type RsvpFormProps = {
  token: string;
  maxGuests: number;
  isLocked: boolean;
};

const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";
const script = "font-[family-name:var(--font-wedding-script),cursive]";

export function RsvpForm({ token, maxGuests, isLocked }: RsvpFormProps) {
  const [attending, setAttending] = useState<"yes" | "no">("yes");
  const [attendingCount, setAttendingCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isLocked) {
    return null;
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await submitRsvpAction(formData);
        window.location.reload();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not submit RSVP.";
        setError(message);
      }
    });
  }

  function step(delta: number) {
    setAttendingCount((current) => {
      const next = current + delta;
      return Math.min(maxGuests, Math.max(1, next));
    });
  }

  return (
    <form
      action={handleSubmit}
      className={`rsvp-fade-up relative w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-5 py-7 shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)] sm:px-8 sm:py-8 ${serif} ${isPending ? "opacity-[0.92]" : ""}`}
      style={{ fontFamily: "var(--font-wedding-sans), sans-serif" }}
      aria-busy={isPending}
    >
      <input type="hidden" name="token" value={token} />

      <p className="text-center text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        RSVP
      </p>
      <p className={`mt-2 text-center text-2xl text-zinc-900 ${script}`}>Will you be attending?</p>

      <div className="mt-7 space-y-3">
        <label className="block cursor-pointer touch-manipulation">
          <input
            type="radio"
            name="attending"
            value="yes"
            checked={attending === "yes"}
            onChange={() => setAttending("yes")}
            className="sr-only"
          />
          <div
            className={`rounded-2xl border-2 px-5 py-4 text-left transition-all duration-300 ease-out ${
              attending === "yes"
                ? "border-emerald-300 bg-emerald-50/70 shadow-[0_10px_30px_-24px_rgba(20,120,80,0.45)]"
                : "border-[#e8dcc4] bg-white"
            }`}
          >
            <span className={`block text-lg text-zinc-900 ${serif}`}>Accept</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-600">We would love to celebrate with you</span>
          </div>
        </label>

        <label className="block cursor-pointer touch-manipulation">
          <input
            type="radio"
            name="attending"
            value="no"
            checked={attending === "no"}
            onChange={() => setAttending("no")}
            className="sr-only"
          />
          <div
            className={`rounded-2xl border-2 px-5 py-4 text-left transition-all duration-300 ease-out ${
              attending === "no"
                ? "border-rose-300 bg-rose-50/70 shadow-[0_10px_30px_-24px_rgba(190,60,80,0.35)]"
                : "border-[#e8dcc4] bg-white"
            }`}
          >
            <span className={`block text-lg text-zinc-900 ${serif}`}>Decline</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-600">We are unable to attend this time</span>
          </div>
        </label>
      </div>

      {attending === "yes" ? (
        <div className="mt-8 rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-5">
          <input type="hidden" name="attendingCount" value={attendingCount} />
          <p className="text-center text-sm font-medium text-zinc-800">Guests attending</p>
          <p className="mt-1 text-center text-xs text-zinc-500">Maximum allowed: {maxGuests}</p>
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={attendingCount <= 1 || isPending}
              aria-label="Decrease guest count"
              className="flex h-[3rem] min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border border-[#d9ccb7] bg-white text-xl font-light text-zinc-700 shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
            >
              −
            </button>
            <div
              className={`flex min-w-[4.75rem] flex-col items-center justify-center rounded-2xl border border-[#ddd0bc] bg-white px-4 py-2.5 ${serif}`}
            >
              <span className="text-[1.85rem] leading-none tabular-nums text-zinc-900">{attendingCount}</span>
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={attendingCount >= maxGuests || isPending}
              aria-label="Increase guest count"
              className="flex h-[3rem] min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border border-[#d9ccb7] bg-white text-xl font-light text-zinc-700 shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`mt-9 w-full rounded-2xl border border-[#3f2f1f] bg-[#3f2f1f] py-4 text-sm font-semibold tracking-[0.08em] text-white shadow-[0_14px_40px_-18px_rgba(50,40,20,0.55)] transition hover:bg-[#352618] active:scale-[0.99] disabled:opacity-60 touch-manipulation ${serif}`}
      >
        {isPending ? "Sending your RSVP..." : "Send RSVP"}
      </button>
    </form>
  );
}
