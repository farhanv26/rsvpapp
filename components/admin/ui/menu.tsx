"use client";

import { useEffect, useRef } from "react";

const PLACEMENT = {
  "bottom-end": "right-0 top-[calc(100%+0.375rem)]",
  "bottom-start": "left-0 top-[calc(100%+0.375rem)]",
  "top-start": "left-0 bottom-[calc(100%+0.375rem)]",
  "top-end": "right-0 bottom-[calc(100%+0.375rem)]",
} as const;

/**
 * Disclosure popover on native <details>: keyboard and screen-reader friendly without a portal.
 * Closes on outside pointer, Escape, or any click on an element marked `data-menu-close`.
 */
export function Menu({
  trigger,
  label,
  children,
  placement = "bottom-end",
  summaryClassName = "icon-btn",
  panelClassName = "w-56",
  className = "",
}: {
  trigger: React.ReactNode;
  label: string;
  children: React.ReactNode;
  placement?: keyof typeof PLACEMENT;
  summaryClassName?: string;
  panelClassName?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const onPointer = (e: PointerEvent) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-menu-close]")) details.open = false;
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    details.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      details.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <details ref={ref} className={`relative ${className}`}>
      <summary aria-label={label} className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}>
        {trigger}
      </summary>
      <div
        className={`absolute z-[100] rounded-xl border border-[var(--border-soft)] bg-white p-1 shadow-lg ring-1 ring-black/[0.03] ${PLACEMENT[placement]} ${panelClassName}`}
      >
        {children}
      </div>
    </details>
  );
}

export function MenuItem({
  children,
  onClick,
  href,
  tone = "default",
  disabled,
  external,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  external?: boolean;
}) {
  const cls = `flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors sm:min-h-9 disabled:opacity-50 ${
    tone === "danger" ? "text-[var(--danger)] hover:bg-rose-50" : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
  }`;
  if (href) {
    return (
      <a href={href} className={cls} data-menu-close onClick={onClick} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} data-menu-close>
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-[var(--border-soft)]" role="separator" />;
}
