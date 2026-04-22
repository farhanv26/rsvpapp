"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEventAction } from "@/app/admin/events/actions";

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
        className={className ?? "btn-secondary border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"}
      >
        {label}
      </button>

      {open ? (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Confirm deletion
            </p>
            <h3 className="mt-3 text-xl font-semibold text-zinc-900">Move this event to trash?</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              The event and <span className="font-semibold text-zinc-900">all guest data</span> are hidden from the
              dashboard and public RSVP until you restore the event from{" "}
              <span className="font-semibold text-zinc-900">Deleted events</span>. Nothing is purged immediately. Other
              users and their events are not affected.
            </p>
            <label className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5 text-sm text-rose-950">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-rose-300"
              />
              <span>I understand this will hide the event until I restore or permanently remove it later.</span>
            </label>

            {error ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  if (isPending) return;
                  setError(null);
                  setOpen(false);
                }}
                disabled={isPending}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runDelete}
                disabled={isPending || !acknowledged}
                className="btn-danger flex-1"
              >
                {isPending ? "Working…" : "Move event to trash"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
