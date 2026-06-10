"use client";

import { useState, useCallback, useEffect } from "react";
import { ITINERARY_ICONS, type ItineraryItem } from "@/components/itinerary-timeline";

type Props = {
  initialItems?: ItineraryItem[];
};

function ItemIconPreview({ name, title }: { name?: string; title?: string }) {
  const resolvedName = (name && name !== "CalendarDays") ? name : undefined;
  const Icon = resolvedName ? ITINERARY_ICONS[resolvedName] : undefined;
  if (!Icon) return null;
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#b28944]/10 text-[#b28944]">
      <Icon size={13} strokeWidth={1.6} aria-hidden />
    </span>
  );
}

export function EventItineraryFields({ initialItems = [] }: Props) {
  const [items, setItems] = useState<ItineraryItem[]>(initialItems);
  const [loadingIcon, setLoadingIcon] = useState<Record<number, boolean>>({});

  function addItem() {
    setItems((prev) => [...prev, { startTime: "", endTime: "", title: "", icon: undefined }]);
  }

  function updateItem(index: number, field: keyof ItineraryItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: "up" | "down") {
    setItems((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
  }

  // On mount, fetch icons for items without one or stuck on the CalendarDays fallback
  useEffect(() => {
    items.forEach((item, i) => {
      if (item.title.trim() && (!item.icon || item.icon === "CalendarDays")) {
        fetchIcon(i, item.title);
      }
    });
    // intentionally run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchIcon = useCallback(async (index: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setLoadingIcon((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/itinerary-icon?title=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const { icon } = await res.json() as { icon: string };
        setItems((prev) =>
          prev.map((item, i) => (i === index ? { ...item, icon } : item)),
        );
      }
    } finally {
      setLoadingIcon((prev) => ({ ...prev, [index]: false }));
    }
  }, []);

  const serialized = JSON.stringify(
    items.filter((x) => (x.startTime ?? x.time ?? "").trim() && x.title.trim()),
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="itinerary" value={serialized} />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dccfbb] bg-[#fbf8f2] px-5 py-7 text-center">
          <p className="text-sm font-medium text-zinc-600">No itinerary added</p>
          <p className="mt-1 text-xs text-zinc-400">
            Add a schedule so guests see timing on their invite page.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#e3d8c7] bg-white p-4"
            >
              {/* Row 1: icon preview + title */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-600">Title</label>
                  {loadingIcon[i] ? (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[#b28944]/40 border-t-[#b28944]" aria-label="Fetching icon…" />
                  ) : (
                    <ItemIconPreview name={item.icon} />
                  )}
                </div>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(i, "title", e.target.value)}
                  onBlur={(e) => fetchIcon(i, e.target.value)}
                  placeholder="Ring Ceremony"
                  className="input-luxe mt-0 text-sm"
                />
              </div>

              {/* Row 2: From + To */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                    From
                  </label>
                  <input
                    type="text"
                    value={item.startTime ?? item.time ?? ""}
                    onChange={(e) => updateItem(i, "startTime", e.target.value)}
                    placeholder="6:00 PM"
                    className="input-luxe mt-0 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                    To{" "}
                    <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={item.endTime ?? ""}
                    onChange={(e) => updateItem(i, "endTime", e.target.value)}
                    placeholder="7:00 PM"
                    className="input-luxe mt-0 text-sm"
                  />
                </div>
              </div>

              {/* Row 3: reorder + remove */}
              <div className="mt-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveItem(i, "up")}
                  disabled={i === 0}
                  aria-label="Move item up"
                  className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#e3d8c7] bg-white text-zinc-400 transition hover:bg-[#faf6ef] hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg viewBox="0 0 10 10" fill="none" className="h-3 w-3" aria-hidden>
                    <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(i, "down")}
                  disabled={i === items.length - 1}
                  aria-label="Move item down"
                  className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#e3d8c7] bg-white text-zinc-400 transition hover:bg-[#faf6ef] hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg viewBox="0 0 10 10" fill="none" className="h-3 w-3" aria-hidden>
                    <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="ml-1 text-[11px] text-zinc-400">
                  {i + 1} of {items.length}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="ml-auto flex h-7 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addItem}
        className="btn-secondary w-full justify-center"
      >
        <svg viewBox="0 0 12 12" fill="none" className="mr-1.5 h-3 w-3" aria-hidden>
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add itinerary item
      </button>
    </div>
  );
}
