"use client";

import { useSyncExternalStore } from "react";

const volatileSections = new Map<string, boolean>();

type Props = {
  id: string;
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function CollapsibleSection({
  id,
  title,
  storageKey,
  defaultOpen = true,
  className,
  children,
}: Props) {
  const key = `dashboard-section:${storageKey}`;
  const open = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener("vowpal-section-change", notify);
      return () => { window.removeEventListener("storage", notify); window.removeEventListener("vowpal-section-change", notify); };
    },
    () => { if (volatileSections.has(key)) return volatileSections.get(key)!; try { const saved = window.localStorage.getItem(key); return saved === null ? defaultOpen : saved !== "0"; } catch { return defaultOpen; } },
    () => defaultOpen,
  );
  function toggle() {
    try { window.localStorage.setItem(key, open ? "0" : "1"); } catch { volatileSections.set(key, !open); }
    window.dispatchEvent(new Event("vowpal-section-change"));
  }

  return (
    <section id={id} className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        className="mb-3 flex w-full items-center gap-3 text-left"
      >
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <div className="h-px flex-1 bg-[var(--border-soft)]" aria-hidden />
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white text-zinc-400 shadow-sm transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-zinc-600"
          aria-hidden
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3.5 w-3.5 transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          >
            <path
              d="M3 6l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* Animated content wrapper using CSS grid trick for smooth height */}
      <div
        id={`${id}-content`}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div inert={!open} className={open ? "" : "pointer-events-none select-none"}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
