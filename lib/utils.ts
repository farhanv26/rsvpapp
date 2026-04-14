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
