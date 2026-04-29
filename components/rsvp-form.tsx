"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRsvpAction } from "@/app/rsvp/[token]/actions";

type RsvpFormProps = {
  token: string;
  maxGuests: number;
  isLocked: boolean;
  previewMode?: boolean;
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
  previewMode = false,
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
    return Math.min(maxGuests, 1);
  });
  const [error, setError] = useState<string | null>(null);
  const [hostMessage, setHostMessage] = useState(initialHostMessage ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isLocked) return null;

  function submitRsvp() {
    if (previewMode) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("token", token);
        formData.set("attending", attending);
        if (attending === "yes") formData.set("attendingCount", String(attendingCount));
        if (hostMessage.trim()) formData.set("hostMessage", hostMessage.trim());
        await submitRsvpAction(formData);
        setShowConfirm(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit RSVP.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (previewMode) return;
    setError(null);
    if (attending === "yes" && (attendingCount < 1 || attendingCount > maxGuests)) {
      setError(`Please choose between 1 and ${maxGuests} guests.`);
      return;
    }
    setShowConfirm(true);
  }

  function step(delta: number) {
    setAttendingCount((c) => Math.min(maxGuests, Math.max(1, c + delta)));
  }

  const canSubmit = attending === "no" || (attendingCount >= 1 && attendingCount <= maxGuests);
  const disabled = previewMode || isPending;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={`tap-highlight-none relative w-full rounded-3xl border border-[#e7dccb] bg-[#fffdfa] px-5 py-7 shadow-[0_20px_55px_-40px_rgba(71,52,29,0.4)] sm:px-8 sm:py-9 ${serif} ${isPending ? "opacity-[0.92]" : ""}`}
        style={{ fontFamily: "var(--font-wedding-sans), sans-serif" }}
        aria-busy={isPending}
      >
        <input type="hidden" name="token" value={token} />
        {previewMode && <input type="hidden" name="previewMode" value="1" readOnly />}

        <div className="text-center">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-zinc-400">RSVP</p>
          {previewMode ? (
            <p className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-center text-xs text-amber-950">
              Preview mode — RSVP submission is turned off.
            </p>
          ) : null}
          <p className={`mt-2 text-[1.7rem] text-zinc-900 ${script}`}>Will you be attending?</p>
        </div>

        {/* Attend / Decline choice */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {(["yes", "no"] as const).map((val) => {
            const isYes = val === "yes";
            const selected = attending === val;
            return (
              <label
                key={val}
                className={`block touch-manipulation ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="attending"
                  value={val}
                  checked={selected}
                  onChange={() => {
                    setAttending(val);
                  }}
                  disabled={disabled}
                  className="sr-only"
                />
                <div
                  className={`rsvp-choice-card rounded-2xl border-2 px-5 py-4 text-left ${
                    selected
                      ? isYes
                        ? "border-emerald-300 bg-emerald-50/70 shadow-[0_8px_24px_-16px_rgba(16,120,80,0.4)]"
                        : "border-rose-300 bg-rose-50/70 shadow-[0_8px_24px_-16px_rgba(190,40,60,0.35)]"
                      : "border-[#e8dcc4] bg-white hover:border-[#d4c4a8] hover:bg-[#faf7f2]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`block text-[1.1rem] text-zinc-900 ${serif}`}>
                        {isYes ? "Accept" : "Decline"}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {isYes ? "I will attend" : "I can't attend"}
                      </span>
                    </div>
                    {/* Selection indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        selected
                          ? isYes
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-rose-400 bg-rose-400"
                          : "border-[#ccc0aa]"
                      }`}
                    >
                      {selected && (
                        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-white" fill="none" aria-hidden>
                          <path d="M1.5 5.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Guest count stepper */}
        {attending === "yes" ? (
          <div className="mt-6 rounded-2xl border border-[#e7dccb] bg-[#fbf8f2] px-4 py-5">
            <input type="hidden" name="attendingCount" value={attendingCount} />
            <p className="text-center text-sm font-medium text-zinc-800">How many guests will attend?</p>
            <p className="mt-0.5 text-center text-xs text-zinc-500">
              Your invitation allows up to {maxGuests} {maxGuests === 1 ? "guest" : "guests"}
            </p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <StepButton
                onClick={() => step(-1)}
                disabled={attendingCount <= 1 || disabled}
                aria-label="Decrease guest count"
              >
                −
              </StepButton>
              <div
                className={`flex min-w-[5rem] flex-col items-center justify-center rounded-2xl border border-[#ddd0bc] bg-white px-4 py-2.5 ${serif}`}
              >
                <span className="text-[2rem] leading-none tabular-nums text-zinc-900">{attendingCount}</span>
                <span className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-zinc-400">
                  {attendingCount === 1 ? "guest" : "guests"}
                </span>
              </div>
              <StepButton
                onClick={() => step(1)}
                disabled={attendingCount >= maxGuests || disabled}
                aria-label="Increase guest count"
              >
                +
              </StepButton>
            </div>
          </div>
        ) : null}

        {/* Optional message to host */}
        <div className="mt-5 rounded-2xl border border-[#e7dccb] bg-white px-4 py-4">
          <p className="text-center text-sm font-medium text-zinc-800">Message to host <span className="text-zinc-400 font-normal">(optional)</span></p>
          <textarea
            value={hostMessage}
            onChange={(e) => setHostMessage(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={disabled}
            className="mt-3 w-full resize-none rounded-2xl border border-[#dccfbb] bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#b28944] focus:ring-2 focus:ring-[#b28944]/20 disabled:cursor-not-allowed disabled:bg-zinc-50"
            placeholder="Write a note for your hosts…"
          />
          <p className="mt-1.5 text-right text-[11px] text-zinc-400">{hostMessage.length}/500</p>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !canSubmit || previewMode}
          className={`mt-8 w-full rounded-2xl border border-[#3f2f1f] bg-[#3f2f1f] py-4 text-sm font-semibold tracking-[0.07em] text-white shadow-[0_14px_40px_-18px_rgba(50,40,20,0.55)] transition hover:bg-[#352618] active:scale-[0.99] disabled:opacity-60 touch-manipulation ${serif}`}
        >
          {previewMode
            ? "Preview — RSVP disabled"
            : isPending
              ? "Sending…"
              : "Review & Submit RSVP"}
        </button>

        {onCancelEdit ? (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={previewMode}
            className="btn-secondary mt-3 w-full disabled:opacity-50"
          >
            Cancel edit
          </button>
        ) : null}
      </form>

      {/* Confirm modal */}
      {showConfirm ? (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="modal-panel">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-zinc-400">Confirm RSVP</p>
            <p className={`mt-3 text-xl leading-snug text-zinc-900 ${serif}`}>
              {attending === "yes"
                ? `Confirming attendance for ${attendingCount} ${attendingCount === 1 ? "guest" : "guests"}.`
                : "Letting your hosts know you can't make it."}
            </p>
            {attending === "yes" && hostMessage.trim() ? (
              <p className="mt-2 text-sm text-zinc-600">
                Your message: <em>&ldquo;{hostMessage.trim()}&rdquo;</em>
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowConfirm(false); submitRsvp(); }}
                className="btn-primary flex-1 py-3.5"
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
                Go back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-[#d9ccb7] bg-white text-xl font-light text-zinc-700 shadow-sm transition hover:border-[#c4b49a] hover:bg-[#faf6ef] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
