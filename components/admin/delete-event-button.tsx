"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEventAction } from "@/app/admin/events/actions";
import { Dialog } from "@/components/admin/ui/dialog";

type Props = {
  eventId: string;
  label?: string;
  className?: string;
  redirectToListOnSuccess?: boolean;
};

export function DeleteEventButton({
  eventId,
  label = "Delete event",
  className,
  redirectToListOnSuccess = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function runDelete() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("eventId", eventId);
      const result = await deleteEventAction(formData);
      if (!result?.ok) {
        setError(result?.error ?? "Could not delete event.");
        return;
      }

      setOpen(false);
      if (redirectToListOnSuccess) {
        router.push("/admin/events?deleted=1");
        return;
      }
      router.replace("/admin/events?deleted=1");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAcknowledged(false);
          setOpen(true);
        }}
        className={className ?? "btn-danger-quiet"}
      >
        {label}
      </button>

      {open ? (
        <Dialog
          open
          size="sm"
          dismissible={!isPending}
          onClose={() => {
            setError(null);
            setOpen(false);
          }}
          title="Delete this event?"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setOpen(false);
                }}
                disabled={isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={runDelete} disabled={isPending || !acknowledged} className="btn-danger">
                {isPending ? "Deleting…" : "Delete event"}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed">
            Its guests&apos; invitation links stop working and it leaves your dashboard. Nothing is erased: you can restore it, with every household and
            reply, from <span className="font-semibold">Events → Deleted</span>.
          </p>
          <label className="mt-4 flex items-start gap-2.5 rounded-md border border-[#e3bdb4] bg-[var(--danger-soft)] px-3 py-2.5 text-sm">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>I understand guests can&apos;t open their invitations until I restore it.</span>
          </label>
          {error ? (
            <p className="notice-error mt-4" role="alert">
              {error}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
