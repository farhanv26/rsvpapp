"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a planning page fails to load. Nothing the user entered has been lost by this. */
export function RouteError({ error, reset, scope }: { error: Error & { digest?: string }; reset: () => void; scope: string }) {
  useEffect(() => {
    console.error(`[${scope}] route error boundary`, { message: error.message, digest: error.digest, stack: error.stack });
  }, [error, scope]);

  return (
    <main className="app-shell">
      <div className="max-w-lg rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-8">
        <h1 className="section-heading text-lg">This page didn&apos;t load</h1>
        <p className="mt-1.5 text-sm text-[var(--muted-text)]">Your saved changes are safe. Try again, or go back to the overview.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/admin/overview" className="btn-secondary">
            Back to overview
          </Link>
        </div>
        {error.digest ? <p className="mt-5 text-xs text-[var(--muted-text)]">Reference {error.digest}</p> : null}
      </div>
    </main>
  );
}
