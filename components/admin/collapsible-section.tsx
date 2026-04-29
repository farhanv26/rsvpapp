"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const key = useMemo(() => `dashboard-section:${storageKey}`, [storageKey]);
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(`dashboard-section:${storageKey}`);
      if (saved === "0") setOpen(false);
      else if (saved === "1") setOpen(true);
    } catch {
      // Ignore storage errors.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }
  }, [key, open, mounted]);

  return (
    <section id={id} className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        className="mb-3 flex w-full items-center gap-3 text-left"
      >
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <div className="h-px flex-1 bg-[#ece4d4]" aria-hidden />
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e7dccb] bg-white text-zinc-400 shadow-sm transition-colors hover:border-[#d4c4a8] hover:bg-[#faf6ef] hover:text-zinc-600"
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
        ref={contentRef}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={open ? "" : "pointer-events-none select-none"}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
