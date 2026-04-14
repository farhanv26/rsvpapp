"use client";

import { useEffect } from "react";

export default function AdminEventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/events] route error boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h2 className="text-lg font-semibold">Admin events failed to render</h2>
          <p className="mt-2 text-sm">
            A runtime error occurred while rendering this page. Please retry, then check production
            logs with the digest if it persists.
          </p>
          {error.digest ? (
            <p className="mt-2 text-xs font-mono text-red-700">Digest: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900"
          >
            Retry render
          </button>
        </div>
      </div>
    </main>
  );
}
