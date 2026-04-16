"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const FONT_OPTIONS = [
  {
    id: "elegant_serif",
    label: "Elegant Serif",
    helper: "Classic formal",
    className: "tracking-wide",
    style: { fontFamily: 'var(--font-wedding-serif), "Playfair Display", Georgia, serif' },
  },
  {
    id: "romantic_script",
    label: "Great Vibes Script",
    helper: "Elegant cursive",
    className: "text-[2.4rem] sm:text-[2.8rem]",
    style: { fontFamily: 'var(--font-wedding-script), "Great Vibes", "Dancing Script", cursive' },
  },
  {
    id: "soft_script",
    label: "Soft Script",
    helper: "Friendly cursive",
    className: "text-[2.2rem] sm:text-[2.6rem]",
    style: { fontFamily: 'var(--font-wedding-script-alt), "Dancing Script", cursive' },
  },
  {
    id: "modern_clean",
    label: "Modern Clean",
    helper: "Simple sans style",
    className: "font-sans tracking-wide",
    style: { fontFamily: '"Inter", "Avenir Next", "Helvetica Neue", Arial, sans-serif' },
  },
  {
    id: "classic_formal",
    label: "Classic Formal",
    helper: "Traditional uppercase",
    className: "uppercase tracking-[0.18em]",
    style: { fontFamily: 'var(--font-wedding-serif), "Cormorant Garamond", Georgia, serif' },
  },
] as const;

type FontStyleId = (typeof FONT_OPTIONS)[number]["id"];

function headingPreviewClass(style: FontStyleId) {
  if (style === "romantic_script") return "text-[2.6rem] sm:text-[3rem]";
  if (style === "soft_script") return "text-[2.5rem] sm:text-[2.9rem]";
  if (style === "modern_clean") return "text-4xl tracking-wide";
  if (style === "classic_formal") return "text-4xl uppercase tracking-[0.14em]";
  return "text-4xl tracking-wide";
}

function salutationPreviewClass(style: FontStyleId) {
  if (style === "romantic_script") return "text-2xl sm:text-[2rem]";
  if (style === "soft_script") return "text-[2rem] sm:text-[2.15rem]";
  if (style === "modern_clean") return "text-2xl tracking-wide";
  if (style === "classic_formal") return "text-2xl uppercase tracking-[0.1em]";
  return "text-2xl";
}

export function EventFontStyleField({ defaultValue = "elegant_serif" }: { defaultValue?: string | null }) {
  const initial = FONT_OPTIONS.some((x) => x.id === defaultValue) ? (defaultValue as FontStyleId) : "elegant_serif";
  const [selected, setSelected] = useState<FontStyleId>(initial);
  const [open, setOpen] = useState(false);
  const [previewCoupleNames, setPreviewCoupleNames] = useState("Farhan & Rafiya");
  const [previewEventTitle, setPreviewEventTitle] = useState("Nikkah Ceremony");
  const pickerRef = useRef<HTMLDivElement>(null);
  const active = useMemo(() => FONT_OPTIONS.find((x) => x.id === selected) ?? FONT_OPTIONS[0], [selected]);

  useEffect(() => {
    const onDocPointerDown = (event: PointerEvent) => {
      const node = pickerRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, []);

  useEffect(() => {
    const coupleInput = document.getElementById("coupleNames") as HTMLInputElement | null;
    const titleInput = document.getElementById("title") as HTMLInputElement | null;
    if (!coupleInput && !titleInput) return;

    const refreshPreview = () => {
      const nextCouple = coupleInput?.value.trim() || "";
      const nextTitle = titleInput?.value.trim() || "";
      setPreviewCoupleNames(nextCouple || "Farhan & Rafiya");
      setPreviewEventTitle(nextTitle || "Nikkah Ceremony");
    };

    refreshPreview();
    coupleInput?.addEventListener("input", refreshPreview);
    titleInput?.addEventListener("input", refreshPreview);
    return () => {
      coupleInput?.removeEventListener("input", refreshPreview);
      titleInput?.removeEventListener("input", refreshPreview);
    };
  }, []);

  return (
    <section className="app-card-muted space-y-4 p-4 sm:p-5">
      <div>
        <p className="section-title">Typography</p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Invitation font style</h2>
        <p className="mt-1 text-sm text-zinc-600">Choose how decorative text appears on the guest RSVP invite page.</p>
      </div>

      <div className="block text-sm font-medium text-zinc-700">
        Style
        <input type="hidden" name="inviteFontStyle" value={selected} />
        <div ref={pickerRef} className="relative mt-2">
          <button
            type="button"
            className="input-luxe mt-0 flex w-full items-center justify-between text-left"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="truncate">
              <span className="text-zinc-900" style={active.style}>
                {active.label}
              </span>
              <span className="ml-2 text-xs text-zinc-500">{active.helper}</span>
            </span>
            <span className="text-zinc-400">{open ? "▴" : "▾"}</span>
          </button>
          {open ? (
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-[#dccfbb] bg-white p-1 shadow-lg">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected === option.id}
                  onClick={() => {
                    setSelected(option.id);
                    setOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition hover:bg-[#f7f1e6] ${
                    selected === option.id ? "bg-[#f8f1e5]" : ""
                  }`}
                >
                  <p className={`text-zinc-900 ${headingPreviewClass(option.id)} ${option.className}`} style={option.style}>
                    {previewCoupleNames}
                  </p>
                  <p className={`mt-1 text-zinc-800 ${salutationPreviewClass(option.id)} ${option.className}`} style={option.style}>
                    Dear {previewEventTitle},
                  </p>
                  <p className={`mt-1 text-zinc-800 ${salutationPreviewClass(option.id)} ${option.className}`} style={option.style}>
                    Will you be attending?
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {option.label} · {option.helper}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[#e7dccb] bg-[#fffdfa] px-4 py-5 text-center">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">Live preview</p>
        <p className={`mt-3 text-zinc-900 ${headingPreviewClass(selected)} ${active.className}`} style={active.style}>
          {previewCoupleNames}
        </p>
        <p className="mt-2 text-sm text-zinc-600">{previewEventTitle}</p>
        <p className={`mt-4 text-zinc-900 ${salutationPreviewClass(selected)} ${active.className}`} style={active.style}>
          Dear Javed &amp; Family,
        </p>
        <p className={`mt-2 text-zinc-900 ${salutationPreviewClass(selected)} ${active.className}`} style={active.style}>
          Will you be attending?
        </p>
        <p className="mt-1 text-xs text-zinc-500">These are the exact RSVP portions that will use this style.</p>
      </div>
    </section>
  );
}
