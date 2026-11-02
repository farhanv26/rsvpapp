"use client";

import { useId, useRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import { selectActiveWeddingAction } from "@/app/admin/weddings/actions";

export type WeddingSwitcherOption = { value: string; label: string };

export function WeddingSwitcher({
  value,
  options,
  returnTo = "/admin/events",
}: {
  value: string;
  options: WeddingSwitcherOption[];
  returnTo?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const single = options.length === 1;
  return (
    <form ref={formRef} action={selectActiveWeddingAction} className="flex min-w-0 items-center gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="sr-only" htmlFor={id}>
        Wedding
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={id}
          name="weddingId"
          defaultValue={value}
          onChange={() => formRef.current?.requestSubmit()}
          className={`block min-h-11 w-full min-w-0 appearance-none truncate rounded-md border bg-transparent py-1.5 pr-8 pl-2.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 sm:min-h-10 ${
            single ? "border-transparent hover:border-[var(--border-strong)]" : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[#b9b0a0]"
          }`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]" aria-hidden />
      </div>
      <noscript>
        <button type="submit" className="btn-secondary text-sm">
          Switch
        </button>
      </noscript>
    </form>
  );
}
