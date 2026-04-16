"use client";

import { useEffect, useState } from "react";
import { SafeEventImage } from "@/components/safe-event-image";

type Props = {
  src: string;
  alt: string;
  hintText?: string;
  previewHeightClassName?: string;
};

export function EventImageLightbox({
  src,
  alt,
  hintText = "View full invitation",
  previewHeightClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [imageRatio, setImageRatio] = useState<number>(3 / 4);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setImageRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="rounded-3xl border border-[#e7dccb] bg-[#f7f2e9] p-4 shadow-[0_20px_55px_-40px_rgba(71,52,29,0.38)] sm:p-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group block w-full rounded-2xl text-left transition focus:outline-none focus:ring-2 focus:ring-[#b28944]/25"
          aria-label="Open full invitation preview"
        >
          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-[#e7dccb] bg-transparent ${previewHeightClassName || ""}`}
            style={previewHeightClassName ? undefined : { aspectRatio: imageRatio }}
          >
            <SafeEventImage
              src={src}
              alt={alt}
              fill
              className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.01]"
              fallbackLabel="Invitation image unavailable"
            />
          </div>
        </button>
        <p className="mt-3 text-center text-xs font-medium text-zinc-500">{hintText}</p>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-5xl rounded-3xl border border-[#e7dccb] bg-[#f7f2e9] p-4 shadow-2xl sm:p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#dccfbb] bg-white text-zinc-700 transition hover:bg-[#faf6ef]"
              aria-label="Close preview"
            >
              ×
            </button>
            <div
              className="relative mx-auto w-full max-w-[92vw] overflow-hidden rounded-2xl border border-[#e7dccb] bg-transparent"
              style={{ aspectRatio: imageRatio, maxHeight: "78vh" }}
            >
              <SafeEventImage
                src={src}
                alt={alt}
                fill
                className="object-contain object-center"
                sizes="100vw"
                priority
                fallbackLabel="Invitation image unavailable"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
