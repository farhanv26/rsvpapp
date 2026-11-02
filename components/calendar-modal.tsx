type Props = {
  icsDataUrl: string;
  googleUrl?: string;
};

export function CalendarModal({ icsDataUrl, googleUrl }: Props) {
  if (!googleUrl) {
    return (
      <a href={icsDataUrl} download="invitation.ics" className="invite-btn-quiet">
        <CalIcon />
        Add to calendar
      </a>
    );
  }

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-[var(--inv-rule,#e3d9c8)] bg-[var(--inv-sheet,#fffdf8)]">
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-h-11 touch-manipulation items-center gap-2 border-r border-[var(--inv-rule,#e3d9c8)] px-4 text-sm font-medium text-[var(--inv-ink,#221b17)] transition-colors hover:bg-[#faf6ee]"
      >
        <CalIcon />
        Google Calendar
      </a>
      <a
        href={icsDataUrl}
        download="invitation.ics"
        className="inline-flex min-h-11 touch-manipulation items-center gap-2 px-4 text-sm font-medium text-[var(--inv-ink,#221b17)] transition-colors hover:bg-[#faf6ee]"
      >
        Apple / other
      </a>
    </div>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-[var(--inv-muted,#6b6157)]" aria-hidden>
      <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.5h12M5.5 2v1.5M10.5 2v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
