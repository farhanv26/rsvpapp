/** A titled group of form fields: heading on the left on wide screens, separated by a rule rather than a card. */
export function FormSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** @deprecated Section numbers are no longer shown. */
  number?: string;
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 border-t border-[var(--border-soft)] py-7 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="section-heading">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--muted-text)]">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Required() {
  return (
    <span className="ml-0.5 text-[var(--muted-text)]" aria-hidden>
      *
    </span>
  );
}

export function Optional() {
  return <span className="ml-1 font-normal text-[var(--muted-text)]">(optional)</span>;
}
