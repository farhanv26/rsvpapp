"use client";

import { useState } from "react";
import { Dialog } from "@/components/admin/ui/dialog";

/**
 * A button that opens a dialog around server-rendered content (usually a form posting to a
 * server action that redirects back). The dialog closes once a form inside it is submitted.
 */
export function DialogTrigger({
  label,
  title,
  description,
  triggerClassName = "btn-secondary",
  triggerAriaLabel,
  size,
  children,
}: {
  label: React.ReactNode;
  title: string;
  description?: string;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={triggerClassName} aria-label={triggerAriaLabel} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description} size={size}>
        <div onSubmitCapture={() => setTimeout(() => setOpen(false), 0)}>{children}</div>
      </Dialog>
    </>
  );
}

/** Submit button that asks for confirmation first. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
