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
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const width = size === "lg" ? "sm:max-w-2xl" : size === "sm" ? "sm:max-w-md" : "sm:max-w-xl";

  return (
    <dialog
      ref={ref}
      className={`sheet text-start ${width}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
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
