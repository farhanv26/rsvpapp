type Props = {
  icsDataUrl: string;
};

export function CalendarModal({ icsDataUrl }: Props) {
  return (
    <a
      href={icsDataUrl}
      download="invitation.ics"
      className="inline-flex items-center gap-2 rounded-2xl border border-[#e7dccb] bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-[#faf6ef] active:scale-[0.99] touch-manipulation"
    >
      <CalIcon />
      Add to calendar
    </a>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-zinc-500" aria-hidden>
      <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 6.5h12M5.5 2v1.5M10.5 2v1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
