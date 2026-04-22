"use client";

type Props = {
  className?: string;
};

export function ScrollToGuestsControl({ className }: Props) {
  return (
    <button
      type="button"
      className={["btn-secondary inline-flex shrink-0", className].filter(Boolean).join(" ")}
      title="Jump to guest list — use Preview guest RSVP on any row"
      onClick={() => {
        const el = document.getElementById("event-guests");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", `#${el.id}`);
        }
      }}
    >
      Guest RSVP preview
    </button>
  );
}
