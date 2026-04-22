"use client";

import { useLayoutEffect } from "react";

/**
 * Ensures the event dashboard opens at the top unless the URL has an in-page hash
 * (e.g. deep-link to a section). Fixes duplicate `#event-guests` targets and scroll restoration
 * jumping the viewport to the guest block.
 */
export function EventDashboardScrollReset({ eventId }: { eventId: string }) {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "auto", block: "start" });
      });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [eventId]);

  return null;
}
