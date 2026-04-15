"use client";

import { useEffect, useMemo, useState } from "react";

type SectionItem = {
  id: string;
  label: string;
};

type Props = {
  items: SectionItem[];
};

export function EventSectionNav({ items }: Props) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const entries: { id: string; top: number }[] = [];

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (!el) return;
      const observer = new IntersectionObserver(
        (obsEntries) => {
          obsEntries.forEach((entry) => {
            if (entry.isIntersecting) {
              const top = Math.abs(entry.boundingClientRect.top);
              const idx = entries.findIndex((e) => e.id === item.id);
              if (idx >= 0) entries[idx] = { id: item.id, top };
              else entries.push({ id: item.id, top });
              const nearest = [...entries].sort((a, b) => a.top - b.top)[0];
              if (nearest) setActiveId(nearest.id);
            }
          });
        },
        {
          root: null,
          rootMargin: "-35% 0px -55% 0px",
          threshold: [0.1, 0.4, 0.7],
        },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  const itemSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (itemSet.has(hash)) setActiveId(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [itemSet]);

  return (
    <div className="sticky top-2 z-30 rounded-2xl border border-[#e7dccb] bg-[#fffdfa]/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[#fffdfa]/80">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const target = document.getElementById(item.id);
                if (!target) return;
                target.scrollIntoView({ behavior: "smooth", block: "start" });
                history.replaceState(null, "", `#${item.id}`);
                setActiveId(item.id);
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-[#3f2f1f] text-white"
                  : "border border-[#e7dccb] bg-[#fbf8f2] text-zinc-700 hover:bg-[#f4ece0]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
