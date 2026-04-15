"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function nextParams(current: URLSearchParams, patch: Record<string, string | null>) {
  const p = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (!value) {
      p.delete(key);
    } else {
      p.set(key, value);
    }
  }
  return p;
}

export function SuperAdminOwnerFilter({
  owner,
  q,
  ownerOptions,
}: {
  owner: string;
  q: string;
  ownerOptions: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localQ, setLocalQ] = useState(q);
  const debouncedQ = useDebouncedValue(localQ, 200);

  useEffect(() => {
    startTransition(() => {
      const p = nextParams(params, { q: debouncedQ.trim() ? debouncedQ.trim() : null });
      router.replace(`${pathname}?${p.toString()}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={localQ}
        onChange={(e) => setLocalQ(e.target.value)}
        placeholder="Search title, couple names, slug, owner"
        className="input-luxe mt-0 w-72 py-2.5 text-sm"
        aria-label="Search events"
        disabled={isPending}
      />
      <select
        value={owner}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          startTransition(() => {
            const p = nextParams(params, { owner: value === "all" ? null : value });
            router.replace(`${pathname}?${p.toString()}`);
          });
        }}
        className="input-luxe mt-0 w-52 py-2.5 text-sm"
        aria-label="Filter by creator owner"
      >
        <option value="all">All creators</option>
        {ownerOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          setLocalQ("");
          startTransition(() => {
            const p = nextParams(params, { q: null, owner: null });
            router.replace(`${pathname}?${p.toString()}`);
          });
        }}
        disabled={isPending}
      >
        Clear
      </button>
      <span className="text-xs text-zinc-500">{isPending ? "Updating..." : ""}</span>
    </div>
  );
}

export function CreatorRealtimeFilters({
  q,
  status,
}: {
  q: string;
  status: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [localQ, setLocalQ] = useState(q);
  const debouncedQ = useDebouncedValue(localQ, 200);

  useEffect(() => {
    startTransition(() => {
      const p = nextParams(params, {
        q: debouncedQ.trim() ? debouncedQ.trim() : null,
      });
      router.replace(`${pathname}?${p.toString()}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const statusValue = useMemo(() => status || "all", [status]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={localQ}
        onChange={(e) => setLocalQ(e.target.value)}
        placeholder="Search event title, couple names, or slug"
        className="input-luxe mt-0 w-72 py-2.5 text-sm"
        aria-label="Search events"
        disabled={isPending}
      />
      <select
        value={statusValue}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          startTransition(() => {
            const p = nextParams(params, { status: value === "all" ? null : value });
            router.replace(`${pathname}?${p.toString()}`);
          });
        }}
        className="input-luxe mt-0 w-44 py-2.5 text-sm"
        aria-label="Filter by RSVP status"
      >
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="closing_soon">Closing soon</option>
        <option value="closes_today">Closes today</option>
        <option value="closed">Closed</option>
      </select>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          setLocalQ("");
          startTransition(() => {
            const p = nextParams(params, { q: null, status: null });
            router.replace(`${pathname}?${p.toString()}`);
          });
        }}
        disabled={isPending}
      >
        Clear
      </button>
    </div>
  );
}

