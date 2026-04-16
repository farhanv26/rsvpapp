"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  entryMatchesQuery,
  getPhoneCountryEntryById,
  phoneCountryFlag,
  sortedPhoneCountryEntries,
  type PhoneCountryEntry,
} from "@/lib/phone-country-data";

const PANEL_Z = 10000;

type Props = {
  valueId: string;
  onChange: (id: string) => void;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
};

export function PhoneCountryCombobox({ valueId, onChange, compact, disabled, className = "" }: Props) {
  const listId = useId();
  const btnId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 288 });

  const ordered = useMemo(() => sortedPhoneCountryEntries(), []);
  const filtered = useMemo(() => {
    if (!query.trim()) return ordered;
    return ordered.filter((e) => entryMatchesQuery(e, query));
  }, [ordered, query]);

  const effectiveHighlight = filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  const selected = getPhoneCountryEntryById(valueId) ?? ordered[0];

  const updatePanelPosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const panelW = Math.max(288, Math.min(320, r.width + 120));
    let left = r.left;
    if (left + panelW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - panelW - 8);
    }
    if (left < 8) left = 8;
    let top = r.bottom + 4;
    const maxH = 320;
    if (top + maxH > window.innerHeight - 8 && r.top > maxH + 16) {
      top = Math.max(8, r.top - 4 - maxH);
    }
    setPanelBox({ top, left, width: panelW });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition, valueId]);

  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => updatePanelPosition();
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (entry: PhoneCountryEntry) => {
      onChange(entry.id);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  const toggleOpen = () => {
    if (disabled) return;
    setOpen((o) => {
      const next = !o;
      if (next) {
        setHighlight(0);
        setQuery("");
        queueMicrotask(() => searchRef.current?.focus());
      }
      return next;
    });
  };

  const onBtnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled && !open) {
        setOpen(true);
        setHighlight(0);
        setQuery("");
        queueMicrotask(() => searchRef.current?.focus());
      }
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[effectiveHighlight];
      if (row) pick(row);
    }
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-index="${effectiveHighlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [effectiveHighlight, open, filtered]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="presentation"
            style={{
              position: "fixed",
              top: panelBox.top,
              left: panelBox.left,
              width: panelBox.width,
              zIndex: PANEL_Z,
            }}
            className="overflow-hidden rounded-xl border border-[#dccfbb] bg-white shadow-[0_12px_40px_-16px_rgba(47,35,20,0.35)]"
          >
            <div className="border-b border-[#eee8dc] p-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search country or code…"
                className="w-full rounded-lg border border-[#e7dfd0] bg-[#fdfaf3] px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#c4a574] focus:outline-none focus:ring-1 focus:ring-[#c4a574]/50"
                aria-label="Search countries"
                autoComplete="off"
              />
            </div>
            <ul
              ref={listRef}
              role="listbox"
              aria-labelledby={btnId}
              className="max-h-60 overflow-y-auto overscroll-contain py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-center text-sm text-zinc-500">No matches</li>
              ) : (
                filtered.map((entry, i) => (
                  <li
                    key={entry.id}
                    role="option"
                    aria-selected={entry.id === valueId}
                    data-index={i}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                      i === effectiveHighlight ? "bg-[#f4ead8]" : "hover:bg-[#faf6ee]"
                    } ${entry.id === valueId ? "font-medium text-zinc-900" : "text-zinc-800"}`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(entry);
                    }}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {phoneCountryFlag(entry.iso2)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <CountryLabel entry={entry} query={query} />
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-500">{entry.dialCode}</span>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className={`relative flex h-full min-h-0 min-w-0 flex-col justify-stretch ${className}`}>
      <button
        ref={btnRef}
        id={btnId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggleOpen}
        onKeyDown={onBtnKeyDown}
        className={`flex h-full min-h-[40px] w-full min-w-0 flex-1 items-center justify-between gap-1.5 rounded-none border-0 bg-transparent px-2.5 pl-3 text-left text-sm text-zinc-900 outline-none transition hover:bg-zinc-50/80 focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-[#b28944]/40 sm:min-w-[8.25rem] ${
          compact ? "sm:min-w-[8.75rem]" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className="text-lg leading-none" aria-hidden>
          {phoneCountryFlag(selected.iso2)}
        </span>
        <span className="min-w-0 shrink font-medium tabular-nums">{selected.dialCode}</span>
        <span className="shrink-0 text-zinc-400" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}

function CountryLabel({ entry, query }: { entry: PhoneCountryEntry; query: string }) {
  const q = query.trim();
  if (!q) {
    return <>{entry.name}</>;
  }
  const lower = entry.name.toLowerCase();
  const qi = q.toLowerCase();
  const idx = lower.indexOf(qi);
  if (idx < 0) {
    return <>{entry.name}</>;
  }
  return (
    <>
      {entry.name.slice(0, idx)}
      <mark className="rounded bg-amber-200/90 px-0.5 text-inherit">{entry.name.slice(idx, idx + q.length)}</mark>
      {entry.name.slice(idx + q.length)}
    </>
  );
}
