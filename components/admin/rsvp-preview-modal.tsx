"use client";

import { useState, useCallback, useEffect } from "react";
import { RsvpPreviewContent } from "@/components/admin/rsvp-preview-content";
import type { LivePreviewData } from "@/components/admin/rsvp-preview-content";
import type { ItineraryItem } from "@/components/itinerary-timeline";

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

/** Read the current value of a form field by name. Returns empty string if not found. */
function fieldVal(fd: FormData, name: string): string {
  return (fd.get(name) as string | null) ?? "";
}

/** Parse a YYYY-MM-DD date string into a UTC midnight Date, or null. */
function parseUTCDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Collect the current form state and turn it into LivePreviewData. */
function collectFormData(formId: string): LivePreviewData | null {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return null;
  const fd = new FormData(form);

  let itinerary: ItineraryItem[] = [];
  try {
    const raw = fieldVal(fd, "itinerary");
    if (raw) itinerary = JSON.parse(raw) as ItineraryItem[];
  } catch {
    itinerary = [];
  }

  return {
    title: fieldVal(fd, "title"),
    coupleNames: fieldVal(fd, "coupleNames"),
    eventSubtitle: fieldVal(fd, "eventSubtitle"),
    eventDate: parseUTCDate(fieldVal(fd, "eventDate")),
    eventTime: fieldVal(fd, "eventTime"),
    venue: fieldVal(fd, "venue"),
    welcomeMessage: fieldVal(fd, "welcomeMessage"),
    description: fieldVal(fd, "description"),
    inviteFontStyle: fieldVal(fd, "inviteFontStyle") || "elegant_serif",
    rsvpDeadline: parseUTCDate(fieldVal(fd, "rsvpDeadline")),
    itinerary,
    imagePath: fieldVal(fd, "imagePath"),
    genericCardImage: fieldVal(fd, "genericCardImage"),
    cardImage1: fieldVal(fd, "cardImage1"),
    cardImage2: fieldVal(fd, "cardImage2"),
    cardImage3: fieldVal(fd, "cardImage3"),
    cardImage4: fieldVal(fd, "cardImage4"),
    familyCardImage: fieldVal(fd, "familyCardImage"),
  };
}

export function RsvpPreviewModal({
  eventId,
  triggerClassName,
  formId,
}: {
  eventId: string;
  triggerClassName?: string;
  /** When provided, clicking Preview reads the current form state and renders a live
   *  client-side preview (no DB save, no iframe). Used on the edit page. */
  formId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState(0);
  const [viewport, setViewport] = useState<Viewport>("mobile");
  const [liveData, setLiveData] = useState<LivePreviewData | null>(null);

  const isLiveMode = Boolean(formId);

  // Iframe URL with cache-buster (used in non-live mode)
  const previewUrl = `/rsvp/preview/${eventId}?_t=${openKey}`;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const currentViewport = VIEWPORTS.find((v) => v.id === viewport) ?? VIEWPORTS[0];

  const handleOpen = () => {
    if (isLiveMode && formId) {
      // Snapshot the current form state — no save, no DB touch
      const data = collectFormData(formId);
      if (data) setLiveData(data);
    }
    setOpenKey(Date.now());
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={triggerClassName ?? "btn-secondary shrink-0"}
      >
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
                    viewport === v.id ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>

            {/* Open in new tab (iframe mode only) */}
            {!isLiveMode ? (
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
            ) : null}

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

          {/* ── Preview area ── */}
          <div className="flex flex-1 items-start justify-center overflow-auto bg-zinc-950 py-6">
            <div
              className="relative overflow-auto rounded-2xl bg-white shadow-2xl transition-all duration-300"
              style={{
                width: currentViewport.width,
                minWidth: viewport === "mobile" ? currentViewport.width : "0",
                maxWidth: viewport === "mobile" ? currentViewport.width : "100%",
                maxHeight: "calc(100vh - 120px)",
              }}
            >
              {isLiveMode && liveData ? (
                <RsvpPreviewContent key={openKey} data={liveData} />
              ) : (
                <>
                  {viewport === "mobile" ? (
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center pb-1 pt-2">
                      <div className="h-1 w-16 rounded-full bg-zinc-200/70" />
                    </div>
                  ) : null}
                  <iframe
                    src={previewUrl}
                    className="h-full w-full border-0"
                    title="RSVP Preview"
                    style={{ display: "block", height: "calc(100vh - 120px)" }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
