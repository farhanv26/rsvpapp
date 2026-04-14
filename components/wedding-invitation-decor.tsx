/** Subtle ornamental SVGs for the guest RSVP page — ivory, gold, restrained. */

export function InvitationCornerFloral({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 8c12 8 22 20 28 34 6-14 16-26 28-34-10 12-14 28-12 44-16-2-32 2-44 12 8-12 20-22 34-28-14-6-26-16-34-28Z"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.45"
      />
      <path
        d="M22 22c8 6 14 14 18 24 4-10 10-18 18-24-6 8-8 18-6 28-10-2-20 2-28 8 6-8 14-14 24-18-8-4-16-10-22-18Z"
        stroke="currentColor"
        strokeWidth="0.45"
        opacity="0.35"
      />
      <circle cx="18" cy="18" r="1.2" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

export function InvitationArchRule({ className }: { className?: string }) {
  return (
    <div
      className={`h-px w-full bg-gradient-to-r from-transparent via-[#c9a227]/50 to-transparent ${className ?? ""}`}
      role="presentation"
    />
  );
}
