"use client";

import { useState, useCallback, useEffect } from "react";

type Viewport = "mobile" | "desktop";

const VIEWPORTS: { id: Viewport; label: string; width: string; icon: React.ReactNode }[] = [
  {
    id: "mobile",
    label: "Phone",
    width: "390px",
    icon: (
      <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <rect x="2.5" y="0.5" width="9" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="7" cy="11.2" r="0.7" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "desktop",
    label: "Desktop",
    width: "100%",
    icon: (
      <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <rect x="0.5" y="1.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 12.5h4M7 10.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function RsvpPreviewModal({
  eventId,
  triggerClassName,
}: {
  eventId: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("mobile");

  const previewUrl = `/rsvp/preview/${eventId}`;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const currentViewport = VIEWPORTS.find((v) => v.id === viewport) ?? VIEWPORTS[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "btn-secondary shrink-0"}
      >
        <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <path d="M1 7s2-4.5 6-4.5S13 7 13 7s-2 4.5-6 4.5S1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Preview RSVP
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-zinc-950/80 backdrop-blur-sm">
          {/* ── Toolbar ── */}
          <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-200">RSVP Preview</span>

            {/* Viewport toggle */}
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 p-1">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewport(v.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewport === v.id
                      ? "bg-zinc-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>

            {/* Open in new tab */}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path d="M6 2H2.5A1.5 1.5 0 0 0 1 3.5v8A1.5 1.5 0 0 0 2.5 13h8A1.5 1.5 0 0 0 12 11.5V8M8 1h5m0 0v5m0-5L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              New tab
            </a>

            {/* Close */}
            <button
              type="button"
              onClick={close}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
              aria-label="Close preview"
            >
              <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ── Preview frame ── */}
          <div className="flex flex-1 items-start justify-center overflow-auto bg-zinc-950 py-6">
            <div
              className="relative overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300"
              style={{
                width: currentViewport.width,
                minWidth: viewport === "mobile" ? currentViewport.width : "0",
                maxWidth: viewport === "mobile" ? currentViewport.width : "100%",
                height: "calc(100vh - 120px)",
              }}
            >
              {/* Phone notch decoration */}
              {viewport === "mobile" ? (
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center pb-1 pt-2">
                  <div className="h-1 w-16 rounded-full bg-zinc-200/70" />
                </div>
              ) : null}
              <iframe
                src={previewUrl}
                className="h-full w-full border-0"
                title="RSVP Preview"
                // Prevents the iframe from inheriting pointer-events that cause scroll issues
                style={{ display: "block" }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
