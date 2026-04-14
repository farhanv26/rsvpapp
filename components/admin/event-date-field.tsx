"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
};

function todayLocalIso() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EventDateField({ id, name, label, defaultValue = "" }: Props) {
  const minDate = useMemo(() => todayLocalIso(), []);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const hasError = value.trim().length > 0 && value < minDate;
    setError(hasError ? "Event date cannot be in the past." : null);
  }, [value, minDate]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }
    const submitButtons = Array.from(
      form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
    );
    submitButtons.forEach((button) => {
      button.disabled = Boolean(error) || button.dataset.pending === "true";
    });
  }, [error]);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        min={minDate}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`input-luxe mt-0 ${error ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
      />
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
