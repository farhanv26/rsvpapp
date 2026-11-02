/** Loading placeholder shaped like a planning page: title, optional tabs, a ruled line, then rows. */
export function PageSkeleton({ tabs = false, rows = 8 }: { tabs?: boolean; rows?: number }) {
  return (
    <main className="app-shell" aria-busy="true">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden>
        <div className="h-7 w-56 rounded bg-[var(--surface-muted)]" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-[var(--surface-muted)]" />
        {tabs ? (
          <div className="mt-6 flex gap-5 border-b border-[var(--border-strong)] pb-3">
            {[64, 84, 76, 64, 56].map((w, i) => (
              <div key={i} className="h-4 rounded bg-[var(--surface-muted)]" style={{ width: w }} />
            ))}
          </div>
        ) : null}
        <div className="mt-6 h-12 border-y border-[var(--border-strong)]" />
        <div className="list-rows mt-6">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-4 w-4 rounded bg-[var(--surface-muted)]" />
              <div className="flex-1">
                <div className="h-4 rounded bg-[var(--surface-muted)]" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
                <div className="mt-1.5 h-3 w-1/4 rounded bg-[var(--surface-muted)]" />
              </div>
              <div className="hidden h-4 w-24 rounded bg-[var(--surface-muted)] sm:block" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
