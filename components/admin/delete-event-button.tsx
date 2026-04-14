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
        onClick={() => setOpen(true)}
        className={className ?? "btn-secondary border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"}
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-[#e7dccb] bg-[#fffdfa] p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Confirm deletion
            </p>
            <h3 className="mt-3 text-xl font-semibold text-zinc-900">
              Are you sure you want to delete this event?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              This will permanently remove the event and its guest list.
            </p>

            {error ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={runDelete}
                disabled={isPending}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-rose-700 bg-rose-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Deleting..." : "Delete Event"}
              </button>
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
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
