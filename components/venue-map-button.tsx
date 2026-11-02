"use client";

export function VenueMapButton({ venue }: { venue: string }) {
  const encoded = encodeURIComponent(venue);
  // maps.google.com — iOS prompts native Maps app; Android opens Google Maps app; desktop opens web
  const mapsUrl = `https://maps.google.com/maps?q=${encoded}`;
  const embedUrl = `https://maps.google.com/maps?q=${encoded}&output=embed&z=15`;

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--inv-rule,#e3d9c8)]">
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
      <div className="bg-[var(--inv-sheet,#fffdf8)] px-5 py-4">
        <p className="text-[0.95rem] font-semibold leading-snug break-words text-[var(--inv-ink,#221b17)]">{venue}</p>

        <a href={mapsUrl} target="_blank" rel="noreferrer noopener" className="invite-btn mt-3">
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
