"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  entryMatchesQuery,
  getPhoneCountryEntryById,
  phoneCountryFlag,
  sortedPhoneCountryEntries,
  type PhoneCountryEntry,
} from "@/lib/phone-country-data";

type Props = {
  valueId: string;
  onChange: (id: string) => void;
  /** Narrow width when embedded in a horizontal phone field */
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
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const ordered = useMemo(() => sortedPhoneCountryEntries(), []);
  const filtered = useMemo(() => {
    if (!query.trim()) return ordered;
    return ordered.filter((e) => entryMatchesQuery(e, query));
  }, [ordered, query]);

  const effectiveHighlight = filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  const selected = getPhoneCountryEntryById(valueId) ?? ordered[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
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

  return (
    <div ref={wrapRef} className={`relative w-full sm:w-auto ${className}`}>
      <button
        id={btnId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggleOpen}
        onKeyDown={onBtnKeyDown}
        className={`flex h-full min-h-[44px] w-full items-center justify-between gap-2 border-0 bg-transparent pl-3 pr-2 text-left text-sm text-zinc-900 outline-none transition hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-[#b28944]/40 sm:w-auto sm:justify-start ${
          compact ? "sm:min-w-[7.25rem]" : "sm:min-w-[9rem]"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className="text-lg leading-none" aria-hidden>
          {phoneCountryFlag(selected.iso2)}
        </span>
        <span className="font-medium tabular-nums">{selected.dialCode}</span>
        <span className="text-zinc-400" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="presentation"
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-[min(calc(100vw-1.5rem),18rem)] overflow-hidden rounded-xl border border-[#dccfbb] bg-white shadow-[0_12px_40px_-16px_rgba(47,35,20,0.35)]"
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
        </div>
      ) : null}
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
