"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modal built on native <dialog>.showModal(): the browser handles focus containment, the inert
 * background, Escape and returning focus to the trigger. Renders as a bottom sheet on phones.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** False while a save is in flight, so the dialog cannot be dismissed mid-request. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // React inserts the form before showModal runs; focus its first visible field now.
      const field = Array.from(d.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea'))
        .find(element => !element.matches(':disabled') && element.getClientRects().length > 0);
      field?.focus({ preventScroll: true });
    }
    if (!open && d.open) d.close();
  }, [open]);

  const width = size === "lg" ? "sm:max-w-2xl" : size === "sm" ? "sm:max-w-md" : "sm:max-w-xl";

  return (
    <dialog
      ref={ref}
      className={`sheet text-start ${width}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const d = event.currentTarget;
        const controls = Array.from(d.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]'))
          .filter(element => !element.matches(':disabled, [tabindex="-1"], input[type="hidden"]') && element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); d.focus(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !d.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col sm:max-h-[min(88dvh,52rem)]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-3.5">
            <div className="min-w-0 pt-1">
              <h2 id={titleId} className="text-base font-semibold leading-snug">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-0.5 text-sm text-[var(--muted-text)]">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" className="icon-btn -mr-2" aria-label="Close" onClick={onClose} disabled={!dismissible}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border-soft)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
