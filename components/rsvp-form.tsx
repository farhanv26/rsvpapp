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
  // First-time responders choose a number explicitly so a default never inflates the headcount.
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
        setError(err instanceof Error ? err.message : "Your reply didn't go through. Please try again.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (previewMode) return;
    setError(null);
    if (attending === "yes" && (attendingCount < 1 || attendingCount > maxGuests)) {
      setError(`Choose how many are coming, from 1 to ${maxGuests}.`);
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
        className={`invite-sheet tap-highlight-none relative w-full px-5 pt-7 pb-6 sm:px-8 sm:pt-9 sm:pb-8 ${isPending ? "opacity-[0.92]" : ""}`}
        aria-busy={isPending}
      >
        <input type="hidden" name="token" value={token} />
        {previewMode && <input type="hidden" name="previewMode" value="1" readOnly />}

        <fieldset disabled={disabled} className="min-w-0">
          <legend className={`block w-full text-center text-[1.75rem] leading-tight text-[var(--inv-ink)] ${serif}`}>Will you be attending?</legend>
          {previewMode ? (
            <p className="mx-auto mt-3 w-fit rounded-md bg-[#f7eedb] px-3 py-1.5 text-center text-xs font-medium text-[#5f3d00]">Preview only. Replies are turned off.</p>
          ) : null}

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {(["yes", "no"] as const).map((val) => {
              const selected = attending === val;
              return (
                <label key={val} className={`block touch-manipulation ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="radio" name="attending" value={val} checked={selected} onChange={() => setAttending(val)} className="peer sr-only" />
                  <span
                    className={`rsvp-choice-card flex min-h-14 items-center justify-between gap-3 rounded-md border px-4 py-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--inv-accent)] ${
                      selected
                        ? "border-[var(--inv-accent)] bg-[var(--inv-accent-soft)] shadow-[inset_0_0_0_1px_var(--inv-accent)]"
                        : "border-[var(--inv-rule)] bg-[var(--inv-sheet)] hover:border-[#cbbfa9]"
                    }`}
                  >
                    <span className={`text-[1.15rem] text-[var(--inv-ink)] ${serif}`}>{val === "yes" ? "Yes, we'll be there" : "Sorry, can't make it"}</span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                        selected ? "border-[var(--inv-accent)] bg-[var(--inv-accent)]" : "border-[#c3b6a0]"
                      }`}
                      aria-hidden
                    >
                      {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {attending === "yes" ? (
            <div className="mt-6 border-t border-[var(--inv-rule)] pt-6 text-center">
              <input type="hidden" name="attendingCount" value={attendingCount} />
              <p className="text-base font-semibold text-[var(--inv-ink)]">How many of you are coming?</p>
              <p className="mt-0.5 text-sm text-[var(--inv-muted)]">
                Your invitation is for up to {maxGuests} {maxGuests === 1 ? "person" : "people"}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <StepButton onClick={() => step(-1)} disabled={attendingCount <= 1 || disabled} aria-label="Decrease guest count">
                  −
                </StepButton>
                <div className="flex min-w-[5.5rem] flex-col items-center justify-center rounded-md border border-[var(--inv-rule)] bg-[var(--inv-sheet)] px-4 py-2" aria-live="polite">
                  <span className={`text-[2.25rem] leading-none tabular-nums text-[var(--inv-ink)] ${serif}`}>{attendingCount}</span>
                  <span className="mt-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--inv-muted)] uppercase">{attendingCount === 1 ? "guest" : "guests"}</span>
                </div>
                <StepButton onClick={() => step(1)} disabled={attendingCount >= maxGuests || disabled} aria-label="Increase guest count">
                  +
                </StepButton>
              </div>
              {attendingCount === 0 ? <p className="mt-3 text-sm font-semibold text-[var(--inv-accent)]">Tap + to choose</p> : null}
            </div>
          ) : null}

          <div className="mt-6 border-t border-[var(--inv-rule)] pt-6">
            <label htmlFor="rsvp-host-message" className="block text-sm font-semibold text-[var(--inv-ink)]">
              A note for the hosts <span className="font-normal text-[var(--inv-muted)]">(optional)</span>
            </label>
            <textarea
              id="rsvp-host-message"
              value={hostMessage}
              onChange={(e) => setHostMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-2 w-full resize-none rounded-md border border-[var(--inv-rule)] bg-[var(--inv-sheet)] px-3.5 py-3 text-base text-[var(--inv-ink)] outline-none transition placeholder:text-[#767064] focus:border-[var(--inv-accent)] focus:ring-2 focus:ring-[var(--inv-accent)]/15 disabled:cursor-not-allowed disabled:bg-[#f6f2ea] sm:text-sm"
              placeholder="Congratulations…"
            />
            <p className="mt-1 text-right text-xs text-[var(--inv-muted)] tabular-nums">{hostMessage.length}/500</p>
          </div>
        </fieldset>

        {error ? (
          <p className="mt-4 rounded-md border border-[#ecc9c1] bg-[#f8e8e4] px-3 py-2 text-center text-sm text-[#7d2416]" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={isPending || !canSubmit || previewMode} className="invite-btn mt-6">
          {previewMode ? "Preview only" : isPending ? "Sending…" : "Continue"}
        </button>

        {onCancelEdit ? (
          <button type="button" onClick={onCancelEdit} disabled={previewMode} className="invite-btn-quiet mt-2.5 w-full">
            Keep my earlier reply
          </button>
        ) : null}
      </form>

      {showConfirm ? (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowConfirm(false);
          }}
        >
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="rsvp-confirm-title" aria-describedby="rsvp-confirm-body">
            <p id="rsvp-confirm-title" className="text-[11px] font-semibold tracking-[0.14em] text-[var(--muted-text)] uppercase">
              Check your reply
            </p>
            <p id="rsvp-confirm-body" className={`mt-3 text-[1.4rem] leading-snug text-[var(--foreground)] ${serif}`}>
              {attending === "yes" ? (attendingCount === 1 ? "1 person is coming." : `${attendingCount} of you are coming.`) : "You can't make it this time."}
            </p>
            {attending === "yes" && hostMessage.trim() ? (
              <p className="mt-2 text-sm text-[var(--muted-text)]">
                Your message: <em>&ldquo;{hostMessage.trim()}&rdquo;</em>
              </p>
            ) : null}
            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  submitRsvp();
                }}
                className="invite-btn flex-1"
                disabled={isPending}
                autoFocus
              >
                Send reply
              </button>
              <button type="button" onClick={() => setShowConfirm(false)} className="invite-btn-quiet min-h-12 flex-1" disabled={isPending}>
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
      className="flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-md border border-[var(--inv-rule)] bg-[var(--inv-sheet)] text-2xl leading-none text-[var(--inv-ink)] transition-colors hover:border-[#cbbfa9] hover:bg-[#faf6ee] active:bg-[#f3ede2] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
