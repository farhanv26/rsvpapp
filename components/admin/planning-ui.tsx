import Link from "next/link";

/** Page title, an optional line of real information (not a restatement of the title) and actions. */
export function PageHeader({
  title,
  meta,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** @deprecated Use `meta` for a single line of useful context. */
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  const line = meta ?? description;
  return (
    <div className="page-header">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1 inline-flex min-h-8 items-center gap-1 text-sm text-[var(--muted-text)] hover:text-[var(--foreground)]">
            <span aria-hidden>←</span> {back.label}
          </Link>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {line ? <p className="page-meta">{line}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function NoWeddingSelected({ hasWeddings }: { hasWeddings: boolean }) {
  return (
    <div className="app-card px-6 py-10 text-center">
      <h2 className="section-heading">{hasWeddings ? "Choose a wedding" : "Create your wedding first"}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted-text)]">
        {hasWeddings ? "Use the wedding switcher to pick one." : "Events, guests, budget and vendors all belong to a wedding."}
      </p>
      {!hasWeddings ? (
        <Link href="/admin/weddings" className="btn-primary mt-4">
          Create a wedding
        </Link>
      ) : null}
    </div>
  );
}

export function Feedback({ saved, error }: { saved?: string | null; error?: string | null }) {
  if (error) {
    return (
      <p className="notice-error mb-4" role="alert">
        {error}
      </p>
    );
  }
  if (saved) {
    return (
      <p className="notice-success mb-4" role="status">
        {saved}
      </p>
    );
  }
  return null;
}

/** One figure in a horizontal summary strip. */
export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-xs text-[var(--muted-text)]">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-[var(--muted-text)]">{hint}</dd> : null}
    </div>
  );
}

/** Summary figures as one bordered strip rather than separate cards. */
export function StatStrip({ children, columns = 4 }: { children: React.ReactNode; columns?: 2 | 3 | 4 | 5 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }[columns];
  return (
    <dl
      className={`grid grid-cols-2 divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] [&>*]:border-[var(--border-soft)] max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(even)]:border-l sm:divide-x ${cols}`}
    >
      {children}
    </dl>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted-text)]">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
