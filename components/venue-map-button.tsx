"use client";

export function VenueMapButton({ venue }: { venue: string }) {
  const encoded = encodeURIComponent(venue);
  // maps.google.com — iOS prompts native Maps app; Android opens Google Maps app; desktop opens web
  const mapsUrl = `https://maps.google.com/maps?q=${encoded}`;
  const embedUrl = `https://maps.google.com/maps?q=${encoded}&output=embed&z=15`;

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#e7dccb] shadow-[0_2px_12px_rgba(63,47,31,0.08)]">
      {/* Real map preview — lazy loaded, no API key */}
      <div className="relative h-44 overflow-hidden bg-[#e8dfd0]">
        <iframe
          src={embedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map: ${venue}`}
          aria-hidden="true"
        />
      </div>

      {/* Venue + single native CTA */}
      <div className="bg-[#fbf8f2] px-5 py-4">
        <p className="text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-zinc-400">
          Location
        </p>
        <p className="mt-1.5 text-[0.95rem] font-semibold leading-snug text-zinc-900">{venue}</p>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#3f2f1f] bg-[#3f2f1f] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(63,47,31,0.45)] transition hover:bg-[#352618] active:scale-[0.99] touch-manipulation"
        >
          <DirectionsIcon />
          Get directions
        </a>
      </div>
    </div>
  );
}

function DirectionsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
