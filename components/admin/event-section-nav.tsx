"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type SectionItem = {
  id: string;
  label: string;
};

type Props = {
  items: SectionItem[];
};

function computeNavOpacity(scrollY: number) {
  return 0.78 + Math.min(scrollY / 320, 1) * 0.22;
}

type NavChrome = { fade: boolean; opacity: number };

const navChromeServer: NavChrome = { fade: false, opacity: 1 };

function readNavChrome(): NavChrome {
  if (typeof window === "undefined") return navChromeServer;
  const mq = window.matchMedia("(min-width: 1024px)");
  const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const active = mq.matches && !rm.matches;
  if (!active) return { fade: false, opacity: 1 };
  const y = window.scrollY || document.documentElement.scrollTop;
  return { fade: true, opacity: computeNavOpacity(y) };
}

function subscribeNavChrome(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(min-width: 1024px)");
  const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf: number | null = null;

  const onScrollTick = () => {
    if (!mq.matches || rm.matches) return;
    if (raf != null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      onStoreChange();
    });
  };

  mq.addEventListener("change", onStoreChange);
  rm.addEventListener("change", onStoreChange);
  window.addEventListener("scroll", onScrollTick, { passive: true });
  return () => {
    mq.removeEventListener("change", onStoreChange);
    rm.removeEventListener("change", onStoreChange);
    window.removeEventListener("scroll", onScrollTick);
    if (raf != null) cancelAnimationFrame(raf);
  };
}

function useDesktopNavChrome(): NavChrome {
  const cache = useRef<NavChrome>(navChromeServer);
  return useSyncExternalStore(
    subscribeNavChrome,
    () => {
      const next = readNavChrome();
      const prev = cache.current;
      if (prev.fade === next.fade && prev.opacity === next.opacity) return prev;
      cache.current = next;
      return next;
    },
    () => navChromeServer,
  );
}

export function EventSectionNav({ items }: Props) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const navChrome = useDesktopNavChrome();

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
    <div
      className="sticky top-2 z-30 rounded-2xl border border-[#e7dccb] bg-[#fffdfa]/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[#fffdfa]/80 lg:shadow-[0_12px_36px_-28px_rgba(71,52,29,0.22)] lg:transition-[opacity,box-shadow] lg:duration-300 lg:ease-out"
      style={navChrome.fade ? { opacity: navChrome.opacity } : undefined}
    >
      <div className="flex gap-2 overflow-x-auto pb-1 lg:gap-2.5 lg:px-0.5">
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
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition lg:py-2 ${
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
