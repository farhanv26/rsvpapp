"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Phone-only primary action in the thumb zone above the tab bar. It appears once the inline
 * button `watchId` has scrolled out of view, so it never covers the controls at the top.
 */
export function PhoneAddButton({ onClick, hidden = false, watchId }: { onClick: () => void; hidden?: boolean; watchId: string }) {
  const [inlineVisible, setInlineVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  if (hidden || inlineVisible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-primary fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 min-h-12 rounded-full px-5 shadow-[0_8px_20px_-6px_rgba(90,31,72,0.5)] sm:hidden"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Add household
    </button>
  );
}
