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
    <div className={`flex flex-wrap items-center gap-2 ${isPending ? "opacity-70" : ""}`}>
      <input
        value={localQ}
        onChange={(e) => setLocalQ(e.target.value)}
        placeholder="Search events or owners"
        className="input-luxe mt-0 w-full sm:w-64"
        aria-label="Search events"
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
        className="input-luxe mt-0 w-auto"
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
        className="btn-ghost text-[var(--muted-text)]"
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
    <div className={`flex flex-wrap items-center gap-2 ${isPending ? "opacity-70" : ""}`}>
      <input
        value={localQ}
        onChange={(e) => setLocalQ(e.target.value)}
        placeholder="Search events"
        className="input-luxe mt-0 w-full sm:w-64"
        aria-label="Search events"
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
        className="input-luxe mt-0 w-auto"
        aria-label="Filter by RSVP status"
      >
        <option value="all">Any reply deadline</option>
        <option value="open">Open for replies</option>
        <option value="closing_soon">Closing soon</option>
        <option value="closes_today">Closes today</option>
        <option value="closed">Replies closed</option>
      </select>
      <button
        type="button"
        className="btn-ghost text-[var(--muted-text)]"
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

