"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRsvpAction } from "@/app/rsvp/[token]/actions";

type RsvpFormProps = {
  token: string;
  maxGuests: number;
  isLocked: boolean;
  initialAttending?: "yes" | "no";
  initialAttendingCount?: number | null;
  initialHostMessage?: string | null;
  onCancelEdit?: () => void;
};

const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";
const script = "font-[family-name:var(--font-wedding-script),cursive]";

export function RsvpForm({
  token,
  maxGuests,
  isLocked,
  initialAttending = "yes",
  initialAttendingCount = null,
  initialHostMessage = null,
  onCancelEdit,
}: RsvpFormProps) {
  const router = useRouter();
  const [attending, setAttending] = useState<"yes" | "no">(initialAttending);
  const [attendingCount, setAttendingCount] = useState(() => {
    if (initialAttending === "yes" && typeof initialAttendingCount === "number") {
      return Math.min(maxGuests, Math.max(0, initialAttendingCount));
    }
    return 0;
  });
  const [error, setError] = useState<string | null>(null);
  const [hostMessage, setHostMessage] = useState(initialHostMessage ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isLocked) {
    return null;
  }

  function submitRsvp() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("token", token);
        formData.set("attending", attending);
        if (attending === "yes") {
          formData.set("attendingCount", String(attendingCount));
        }
        if (hostMessage.trim()) {
          formData.set("hostMessage", hostMessage.trim());
        }
        await submitRsvpAction(formData);
        setShowConfirm(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not submit RSVP.";
        setError(message);
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (attending === "yes" && (attendingCount < 1 || attendingCount > maxGuests)) {
      setError(`Please choose between 1 and ${maxGuests} guests.`);
      return;
    }
    setShowConfirm(true);
  }

  function step(delta: number) {
    setAttendingCount((current) => {
      const next = current + delta;
      return Math.min(maxGuests, Math.max(0, next));
    });
  }

  const canSubmit = attending === "no" || (attendingCount >= 1 && attendingCount <= maxGuests);

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className={`rsvp-fade-up relative w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-5 py-7 shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)] sm:px-8 sm:py-8 ${serif} ${isPending ? "opacity-[0.92]" : ""}`}
      style={{ fontFamily: "var(--font-wedding-sans), sans-serif" }}
      aria-busy={isPending}
    >
      <input type="hidden" name="token" value={token} />

      <p className="text-center text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        RSVP
      </p>
      <p className={`mt-2 text-center text-2xl text-zinc-900 ${script}`}>Will you be attending?</p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <label className="block cursor-pointer touch-manipulation">
          <input
            type="radio"
            name="attending"
            value="yes"
            checked={attending === "yes"}
            onChange={() => {
              setAttending("yes");
              setAttendingCount(0);
            }}
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
            <span className="mt-1 block text-xs leading-relaxed text-zinc-600">I will attend</span>
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
            <span className="mt-1 block text-xs leading-relaxed text-zinc-600">I can&apos;t attend</span>
          </div>
        </label>
      </div>

      {attending === "yes" ? (
        <div className="mt-8 rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-5">
          <input type="hidden" name="attendingCount" value={attendingCount} />
          <p className="text-center text-sm font-medium text-zinc-800">Guests attending</p>
          <p className="mt-1 text-center text-xs text-zinc-500">Select how many guests will attend</p>
          <p className="mt-1 text-center text-xs text-zinc-500">Your invitation allows up to {maxGuests} guests</p>
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={attendingCount <= 0 || isPending}
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

      <div className="mt-8 rounded-2xl border border-[#e7dccb] bg-white px-4 py-4">
        <p className="text-center text-sm font-medium text-zinc-800">Message to host (optional)</p>
        <p className="mt-1 text-center text-xs text-zinc-500">Share a quick note with your hosts.</p>
        <textarea
          value={hostMessage}
          onChange={(e) => setHostMessage(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-3 w-full rounded-2xl border border-[#dccfbb] bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#b28944] focus:ring-2 focus:ring-[#b28944]/20"
          placeholder="Write a message…"
        />
        <p className="mt-2 text-right text-[11px] text-zinc-500">{hostMessage.length}/500</p>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !canSubmit}
        className={`mt-9 w-full rounded-2xl border border-[#3f2f1f] bg-[#3f2f1f] py-4 text-sm font-semibold tracking-[0.08em] text-white shadow-[0_14px_40px_-18px_rgba(50,40,20,0.55)] transition hover:bg-[#352618] active:scale-[0.99] disabled:opacity-60 touch-manipulation ${serif}`}
      >
        {isPending ? "Sending your RSVP..." : "Review RSVP"}
      </button>
      {onCancelEdit ? (
        <button type="button" onClick={onCancelEdit} className="btn-secondary mt-3 w-full">
          Cancel edit
        </button>
      ) : null}
    </form>
    {showConfirm ? (
      <div className="modal-backdrop">
        <div className="modal-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Confirm RSVP</p>
          <p className="mt-3 text-base text-zinc-800">
            {attending === "yes"
              ? `You’re confirming attendance for ${attendingCount} guest(s).`
              : "You’re letting your hosts know you can’t make it."}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                submitRsvp();
              }}
              className="btn-primary flex-1"
              disabled={isPending}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="btn-secondary flex-1"
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
