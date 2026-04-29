const serif = "font-[family-name:var(--font-wedding-serif),Georgia,serif]";

export type ItineraryItem = {
  time: string;
  title: string;
  description?: string | null;
};

export function ItineraryTimeline({ items }: { items: ItineraryItem[] }) {
  if (!items.length) return null;

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#fbf8f2]">
      {/* Header */}
      <div className="border-b border-[#ece4d4] px-5 py-4 text-center">
        <div className="mx-auto mb-3 h-px w-16 bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" aria-hidden />
        <p className="text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-zinc-400">
          Schedule
        </p>
      </div>

      {/* Timeline */}
      <div className="relative px-5 py-5">
        {/* Vertical line */}
        <div
          className="absolute bottom-6 top-6 w-px"
          style={{
            left: "calc(1.25rem + 4.5rem)",
            background: "linear-gradient(to bottom, #d4aa6a 0%, rgba(215,186,149,0.3) 100%)",
          }}
          aria-hidden
        />

        <div className="space-y-5">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-0">
              {/* Time */}
              <div className="w-[4.5rem] shrink-0 pt-0.5 pr-3 text-right">
                <span className="text-[0.65rem] font-semibold leading-tight text-[#8b6a34]">
                  {item.time}
                </span>
              </div>

              {/* Dot */}
              <div className="relative z-10 flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full border-2 border-[#b28944] bg-[#fbf8f2]" />
              </div>

              {/* Content */}
              <div className="flex-1 pl-3 pb-2">
                <p className={`text-[0.875rem] font-semibold leading-snug text-zinc-900 ${serif}`}>
                  {item.title}
                </p>
                {item.description ? (
                  <p className="mt-0.5 text-[0.78rem] leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
