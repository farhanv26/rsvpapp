"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    try {
      const saved = window.localStorage.getItem(`dashboard-section:${storageKey}`);
      if (saved === "0") return false;
      if (saved === "1") return true;
    } catch {
      // Ignore storage errors; keep runtime behavior stable.
    }
    return defaultOpen;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }
  }, [key, open]);

  return (
    <section id={id} className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open ? children : null}
    </section>
  );
}
