"use client";

import { useRef } from "react";
import { selectActiveWeddingAction } from "@/app/admin/weddings/actions";

export type WeddingSwitcherOption = { value: string; label: string };

export function WeddingSwitcher({
  value,
  options,
  returnTo = "/admin/events",
}: {
  value: string;
  options: WeddingSwitcherOption[];
  returnTo?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={selectActiveWeddingAction} className="flex min-w-0 items-center gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="sr-only" htmlFor="active-wedding">
        Active wedding
      </label>
      <select
        id="active-wedding"
        name="weddingId"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        className="input-luxe mt-0 w-full min-w-0 truncate pr-8 font-medium"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn-secondary text-sm">
          Switch
        </button>
      </noscript>
    </form>
  );
}
