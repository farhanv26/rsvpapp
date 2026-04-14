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
      className={`rsvp-fade-up relative w-full rounded-[1.85rem] border border-[#d4af37]/35 bg-[#fdfcf9] px-5 py-8 shadow-[0_26px_72px_-46px_rgba(80,60,30,0.45)] sm:px-8 sm:py-9 ${serif} ${isPending ? "opacity-[0.92]" : ""}`}
      style={{ fontFamily: "var(--font-wedding-sans), sans-serif" }}
      aria-busy={isPending}
    >
      <input type="hidden" name="token" value={token} />

      <p className={`text-center text-[0.62rem] font-semibold uppercase tracking-[0.38em] text-[#9a7b2c]`}>
        Kindly respond
      </p>
      <p className={`mt-2 text-center text-xl text-[#2c2419] ${script}`}>Your reply</p>

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
                ? "border-[#c9a227]/80 bg-[linear-gradient(145deg,#fffdf9_0%,#f8f0e4_100%)] shadow-[0_10px_36px_-22px_rgba(120,90,40,0.45)]"
                : "border-[#e8dcc4]/90 bg-white"
            }`}
          >
            <span className={`block text-lg text-[#2c2419] ${serif}`}>Joyfully Accept</span>
            <span className="mt-1 block text-xs leading-relaxed text-[#7a7268]">
              We will be there with grateful hearts
            </span>
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
                ? "border-[#c9a227]/80 bg-[linear-gradient(145deg,#fffdf9_0%,#f3ebe0_100%)] shadow-[0_10px_36px_-22px_rgba(90,70,40,0.4)]"
                : "border-[#e8dcc4]/90 bg-white"
            }`}
          >
            <span className={`block text-lg text-[#2c2419] ${serif}`}>Regretfully Decline</span>
            <span className="mt-1 block text-xs leading-relaxed text-[#7a7268]">
              With love, though we cannot attend
            </span>
          </div>
        </label>
      </div>

      {attending === "yes" ? (
        <div className="mt-8 rounded-2xl border border-[#e8dcc4]/90 bg-[#fffdf9] px-4 py-5">
          <input type="hidden" name="attendingCount" value={attendingCount} />
          <p className="text-center text-sm font-medium text-[#3d3429]">Guests attending</p>
          <p className="mt-1 text-center text-xs text-[#8a8278]">From your invitation · max {maxGuests}</p>
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={attendingCount <= 1 || isPending}
              aria-label="Decrease guest count"
              className="flex h-[3rem] min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/40 bg-white text-xl font-light text-[#4a4238] shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
            >
              −
            </button>
            <div
              className={`flex min-w-[4.75rem] flex-col items-center justify-center rounded-2xl border border-[#e5d9c4] bg-[#fdfbf7] px-4 py-2.5 ${serif}`}
            >
              <span className="text-[1.85rem] leading-none tabular-nums text-[#2c2419]">{attendingCount}</span>
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={attendingCount >= maxGuests || isPending}
              aria-label="Increase guest count"
              className="flex h-[3rem] min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/40 bg-white text-xl font-light text-[#4a4238] shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`mt-9 w-full rounded-2xl border border-[#8a7235]/90 bg-[linear-gradient(180deg,#6b5a2e_0%,#4a3d22_100%)] py-4 text-[0.95rem] font-semibold tracking-[0.12em] text-[#fdfcf3] shadow-[0_14px_40px_-18px_rgba(50,40,20,0.55)] transition active:scale-[0.99] disabled:opacity-60 touch-manipulation ${serif}`}
      >
        {isPending ? "Sending your reply…" : "Send our reply"}
      </button>
    </form>
  );
}
