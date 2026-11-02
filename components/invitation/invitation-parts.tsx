import { EventImageLightbox } from "@/components/event-image-lightbox";

export const inviteSerif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";
const inviteScript = "font-[family-name:var(--font-wedding-script),cursive]";

/** The couple's chosen invitation style decides the names' typeface; the product never overrides it. */
export function headingClassFor(style: string | null | undefined) {
  if (style === "romantic_script") return `${inviteScript} text-[2.75rem] sm:text-[3.25rem]`;
  if (style === "soft_script") return "text-[2.6rem] sm:text-[3rem] [font-family:var(--font-wedding-script-alt),cursive]";
  if (style === "modern_clean") return "font-sans text-4xl font-semibold tracking-[-0.01em] sm:text-[2.6rem]";
  if (style === "classic_formal") return "font-serif text-[2rem] uppercase tracking-[0.14em] sm:text-4xl";
  return `${inviteSerif} text-[2.6rem] sm:text-[3rem]`;
}

export function salutationClassFor(style: string | null | undefined) {
  if (style === "romantic_script") return `${inviteScript} text-[1.9rem] sm:text-[2.1rem]`;
  if (style === "soft_script") return "text-[1.8rem] sm:text-[2rem] [font-family:var(--font-wedding-script-alt),cursive]";
  if (style === "modern_clean") return "font-sans text-xl font-semibold";
  if (style === "classic_formal") return "font-serif text-xl uppercase tracking-[0.1em]";
  return `${inviteSerif} text-2xl`;
}

export function formatEventTime(raw: string | null | undefined) {
  if (!raw) return null;
  const t = raw.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h24 = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h24) || !Number.isFinite(min)) return t;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

/** The invitation itself: card image, names, event, then the personal greeting. */
export function InvitationSheet({
  imageSrc,
  imageAlt,
  names,
  eventTitle,
  subtitle,
  fontStyle,
  greeting,
  children,
}: {
  imageSrc: string | null;
  imageAlt: string;
  names: string;
  /** Shown under the names when the names are the couple's rather than the event title. */
  eventTitle: string | null;
  subtitle: string | null;
  fontStyle: string | null | undefined;
  greeting: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="invite-sheet px-5 pt-6 pb-8 sm:px-10 sm:pt-8 sm:pb-10">
      {imageSrc ? (
        <div className="mx-auto mb-8 w-full max-w-[30rem]">
          <EventImageLightbox src={imageSrc} alt={imageAlt} hintText="Tap to enlarge invitation" />
        </div>
      ) : null}
      <div className="text-center">
        <div className="invite-rule" aria-hidden />
        <h1 className={`mt-6 leading-[1.12] text-balance text-[var(--inv-ink)] ${headingClassFor(fontStyle)}`}>{names}</h1>
        {eventTitle ? <p className="mt-3 text-[13px] font-semibold tracking-[0.18em] text-[var(--inv-accent)] uppercase">{eventTitle}</p> : null}
        {subtitle ? <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--inv-muted)]">{subtitle}</p> : null}
      </div>
      <div className="mx-auto mt-8 max-w-md border-t border-[var(--inv-rule)] pt-7 text-center">
        <p className={`text-[var(--inv-ink)] ${salutationClassFor(fontStyle)}`}>{greeting}</p>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#4a413a]">{children}</div>
      </div>
    </section>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** Date, time, venue and the reply deadline as ruled register rows. */
export function InvitationDetails({
  eventDate,
  eventTime,
  venue,
  replyBy,
  replyNote,
  replyUrgent = false,
}: {
  eventDate: Date | null;
  eventTime: string | null;
  venue: string | null;
  replyBy: Date | null;
  replyNote?: string | null;
  replyUrgent?: boolean;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (eventDate) rows.push({ label: "Date", value: dayFmt.format(eventDate) });
  if (eventTime) rows.push({ label: "Time", value: formatEventTime(eventTime) ?? eventTime });
  if (venue) rows.push({ label: "Venue", value: venue });
  if (replyBy) {
    rows.push({
      label: "Reply by",
      value: (
        <>
          {shortFmt.format(replyBy)}
          {replyNote ? (
            <span className={`mt-0.5 block font-sans text-[13px] ${replyUrgent ? "font-semibold text-[var(--inv-accent)]" : "text-[var(--inv-muted)]"}`}>{replyNote}</span>
          ) : null}
        </>
      ),
    });
  }
  if (rows.length === 0) return null;
  return (
    <dl className="invite-sheet divide-y divide-[var(--inv-rule)] px-5 sm:px-8">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-4 py-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
          <dt className="invite-label">{r.label}</dt>
          <dd className={`text-lg leading-snug break-words text-[var(--inv-ink)] ${inviteSerif}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
