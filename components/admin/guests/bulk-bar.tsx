"use client";

import { X } from "lucide-react";

/** Contextual actions for the selected households. Only rendered while something is selected. */
export function BulkBar({
  count,
  scope,
  onClear,
  children,
  footnote,
}: {
  count: number;
  scope?: React.ReactNode;
  onClear: () => void;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label="Actions for selected households"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--foreground)] bg-[var(--foreground)] py-2 pr-2 pl-4 text-white shadow-[0_10px_30px_rgba(28,25,21,0.25)] lg:bottom-5 lg:left-[calc(14rem+2rem)]"
    >
      <p className="text-sm tabular-nums" aria-live="polite">
        <span className="font-semibold">{count} selected</span>
        {scope ? <span className="text-white/70"> {scope}</span> : null}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-1.5 [&_.btn-secondary]:border-white/25 [&_.btn-secondary]:bg-transparent [&_.btn-secondary]:text-white [&_.btn-secondary:hover]:bg-white/10">
        {children}
        <button type="button" className="icon-btn text-white/80 hover:bg-white/10 hover:text-white" aria-label="Clear selection" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {footnote ? <p className="w-full text-xs text-white/70">{footnote}</p> : null}
    </div>
  );
}
