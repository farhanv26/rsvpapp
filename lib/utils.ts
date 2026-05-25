export function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/** Public site origin for links (no trailing slash). Server-safe for passing into client components. */
export function getPublicSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  return "";
}

/**
 * Absolute URL for RSVP paths. Prefer setting `NEXT_PUBLIC_APP_URL` in production.
 * Falls back to `VERCEL_URL` on Vercel builds. In the browser, uses `window.location.origin` if no env base.
 */
export function buildAbsoluteUrl(pathname: string) {
  const base = getPublicSiteUrl();
  if (base) {
    return `${base}${pathname}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${pathname}`;
  }
  return pathname;
}

/** Absolute RSVP URL for a guest token (server-safe; uses `getPublicSiteUrl`). */
export function buildGuestRsvpAbsoluteUrl(token: string) {
  return buildAbsoluteUrl(`/rsvp/${token}`);
}

/** Guards Image src values so malformed DB values do not crash rendering. */
export function getSafeImageSrc(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const src = value.trim();
  if (!src) {
    return null;
  }
  if (src.startsWith("/")) {
    return src;
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return null;
}

export type RsvpDeadlineStatus = "open" | "closing_soon" | "closes_today" | "closed";

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** Returns the calendar date of `ts` as a UTC-midnight Date, interpreted in Eastern time (ET). */
export function easternCalendarDay(ts: Date): Date {
  const ymd = ts.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function getRsvpDeadlineMeta(deadline: Date | null | undefined, now = new Date()) {
  if (!deadline) {
    return null;
  }
  // "today" is the Eastern-timezone calendar date so daysRemaining matches
  // what the user sees on their clock regardless of where the server runs.
  // Deadline is stored as UTC midnight so we extract its UTC date parts.
  const today = easternCalendarDay(now);
  const deadlineDay = startOfUtcDay(deadline);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round((deadlineDay.getTime() - today.getTime()) / msPerDay);

  let status: RsvpDeadlineStatus;
  if (daysRemaining < 0) {
    status = "closed";
  } else if (daysRemaining === 0) {
    status = "closes_today";
  } else if (daysRemaining <= 7) {
    status = "closing_soon";
  } else {
    status = "open";
  }

  return {
    status,
    daysRemaining,
    deadlineDay,
  };
}
