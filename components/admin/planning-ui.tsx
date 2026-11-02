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
          <Link href={back.href} className="mb-1.5 inline-flex min-h-8 items-center gap-1 text-sm text-[var(--muted-text)] hover:text-[var(--foreground)]">
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
    <EmptyState
      title={hasWeddings ? "Choose a wedding" : "Create your wedding first"}
      action={
        !hasWeddings ? (
          <Link href="/admin/weddings" className="btn-primary">
            Create a wedding
          </Link>
        ) : null
      }
    >
      {hasWeddings ? "Pick one from the wedding switcher." : "Events, guests, budget and vendors all belong to a wedding."}
    </EmptyState>
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

/** One fact in a ruled line: "30 households · 25 at more than one event". `label` reads after the figure. */
export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="order-2 text-sm">
        {label}
        {hint ? <span className="text-[var(--muted-text)]"> · {hint}</span> : null}
      </dt>
      <dd className="order-1 text-lg leading-tight font-bold tracking-[-0.01em] tabular-nums">{value}</dd>
    </div>
  );
}

/** Facts as one ruled line of the register, not a row of boxes. */
export function StatStrip({ children }: { children: React.ReactNode; columns?: 2 | 3 | 4 | 5 }) {
  return <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-[var(--border-strong)] py-3">{children}</dl>;
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-6 py-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted-text)]">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** ink = coming or allocated · soft = awaiting reply · pale = not invited yet · hatch = held by a declined household. */
export type RegisterSegment = { places: number; tone: "ink" | "accent" | "soft" | "pale" | "hatch"; label: string };

function tickStep(total: number) {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 250]) if (total / step <= 30) return step;
  return 500;
}

/**
 * The place register: a ruled strip with one cell per place (or per group of places on large
 * lists), filled left to right by the segments. Anything past `total` is drawn as overflow.
 */
export function PlaceRegister({
  total,
  segments,
  label,
  ruled = true,
}: {
  total: number;
  segments: RegisterSegment[];
  label: string;
  /** False for amounts that aren't countable places (money): no cell rules, no counts in tooltips. */
  ruled?: boolean;
}) {
  const filled = segments.reduce((s, x) => s + Math.max(x.places, 0), 0);
  const scale = Math.max(total, filled, 1);
  const over = Math.max(filled - total, 0);
  const step = tickStep(scale);
  const before = segments.map((_, i) => segments.slice(0, i).reduce((s, x) => s + Math.max(x.places, 0), 0));
  return (
    <div className="register-strip" role="img" aria-label={label} style={{ "--tick": `${(step / scale) * 100}%` } as React.CSSProperties}>
      {segments.map((s, i) => {
        const inside = Math.max(Math.min(Math.max(s.places, 0), total - before[i]!), 0);
        return inside > 0 ? (
          <span key={i} className={`seg seg-${s.tone}`} style={{ width: `${(inside / scale) * 100}%` }} title={ruled ? `${s.label}: ${s.places}` : s.label} />
        ) : null;
      })}
      {over > 0 ? <span className="seg seg-over" style={{ width: `${(over / scale) * 100}%` }} title={ruled ? `${over} over` : "Over"} /> : null}
      {ruled && scale <= 400 ? <span className="ticks" aria-hidden /> : null}
    </div>
  );
}

/** "48 of 75 places allocated · 27 left", with the state carried in words as well as colour. */
export function AllowanceRegister({
  name,
  used,
  places,
  declinedPlaces = 0,
  href,
  compact = false,
}: {
  name?: React.ReactNode;
  used: number;
  places: number;
  declinedPlaces?: number;
  href?: string;
  compact?: boolean;
}) {
  const left = places - used;
  const held = Math.min(Math.max(declinedPlaces, 0), used);
  const status = left < 0 ? `${-left} over` : left === 0 ? "None left" : `${left} left`;
  const tone = left < 0 ? "text-[var(--danger)] font-semibold" : left === 0 ? "text-[var(--warning)] font-semibold" : "text-[var(--muted-text)]";
  return (
    <div className={compact ? "min-w-0" : "min-w-0 max-w-md"}>
      {name ? (
        <p className="truncate text-[13px] font-semibold">
          {href ? (
            <Link href={href} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </p>
      ) : null}
      <div className="flex items-baseline justify-between gap-x-3 text-sm tabular-nums">
        <span className="min-w-0">
          <span className="font-semibold">{used}</span> of {places} places allocated
        </span>
        <span className={`shrink-0 ${tone}`}>{status}</span>
      </div>
      <div className="mt-1.5">
        <PlaceRegister
          total={places}
          segments={[
            { places: used - held, tone: "ink", label: "Allocated" },
            { places: held, tone: "hatch", label: "Held by declined households" },
          ]}
          label={`${used} of ${places} places allocated${held ? `, ${held} held by declined households` : ""}, ${status.toLowerCase()}`}
        />
      </div>
      {held > 0 && !compact ? <p className="mt-1 text-xs text-[var(--muted-text)]">{held} held by households that declined</p> : null}
    </div>
  );
}
