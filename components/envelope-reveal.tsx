"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "pending" | "sealed" | "opening" | "revealing" | "open";

type Props = {
  children: React.ReactNode;
  /** Skip the envelope — only for admin preview mode */
  skip?: boolean;
  guestName?: string;
};

export function EnvelopeReveal({
  children,
  skip = false,
  guestName,
}: Props) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function handleOpen() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPhase("open");
      return;
    }
    setPhase("opening");
    timers.current = [setTimeout(() => setPhase("revealing"), 700), setTimeout(() => setPhase("open"), 1200)];
  }

  // Avoid flash of envelope on server / hydration — match envelope background so there's no white flash
  if (phase === "pending") {
    return <div className="min-h-dvh bg-[var(--inv-ground)]" aria-hidden />;
  }

  if (skip || phase === "open") {
    return <>{children}</>;
  }

  return (
    <EnvelopeScreen
      phase={phase}
      guestName={guestName}
      onOpen={handleOpen}
    />
  );
}

function EnvelopeScreen({
  phase,
  guestName,
  onOpen,
}: {
  phase: Phase;
  guestName?: string;
  onOpen: () => void;
}) {
  const isOpening = phase === "opening" || phase === "revealing";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--inv-ground)] px-5 py-10">
      <div className="relative z-10 flex w-full max-w-[23rem] flex-col items-center">

        {/* Envelope wrapper — slides up + fades on revealing */}
        <button
          type="button"
          onClick={isOpening ? undefined : onOpen}
          disabled={isOpening}
          aria-label="Open your invitation"
          className="group w-full cursor-pointer focus:outline-none disabled:cursor-default"
          style={{
            transform: phase === "revealing" ? "translateY(-28px) scale(0.97)" : "translateY(0) scale(1)",
            opacity: phase === "revealing" ? 0 : 1,
            transition:
              phase === "revealing"
                ? "transform 0.5s cubic-bezier(0.4, 0, 1, 1), opacity 0.5s ease"
                : undefined,
          }}
        >
          <EnvelopeCard isOpening={isOpening} guestName={guestName} />
        </button>

        {/* Tap hint */}
        <p
          className="mt-6 text-center text-sm font-medium text-[var(--inv-muted)] transition-all duration-300 group-hover:text-[var(--inv-ink)]"
          style={{
            opacity: isOpening ? 0 : 1,
            transform: isOpening ? "translateY(4px)" : "translateY(0)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
          aria-hidden={isOpening}
        >
          Tap to open your invitation
        </p>
      </div>
    </div>
  );
}

function EnvelopeCard({ isOpening, guestName }: { isOpening: boolean; guestName?: string }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[10px] border border-[#ddd2bf] bg-[#fbf7ef]"
      style={{
        aspectRatio: "1.6 / 1",
        boxShadow: "0 1px 2px rgba(34,27,23,0.06), 0 30px 60px -30px rgba(60,34,48,0.45)",
      }}
    >
      {/* Bottom-left fold triangle */}
      <div
        className="absolute bottom-0 left-0 h-0 w-0"
        style={{
          borderLeft: "clamp(80px,40%,160px) solid #f3ece0",
          borderTop: "clamp(60px,32%,120px) solid transparent",
        }}
        aria-hidden
      />
      {/* Bottom-right fold triangle */}
      <div
        className="absolute bottom-0 right-0 h-0 w-0"
        style={{
          borderRight: "clamp(80px,40%,160px) solid #f3ece0",
          borderTop: "clamp(60px,32%,120px) solid transparent",
        }}
        aria-hidden
      />

      {guestName ? (
        <p
          className="absolute inset-x-6 bottom-[14%] truncate text-center font-[family-name:var(--font-wedding-serif),Georgia,serif] text-[1.35rem] leading-tight text-[var(--inv-ink)]"
          style={{ opacity: isOpening ? 0 : 1, transition: "opacity 0.3s ease" }}
        >
          {guestName}
        </p>
      ) : null}

      {/* Top flap — V shape, animates up on open */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: "52%",
          perspective: "500px",
        }}
        aria-hidden
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            background: "#efe6d6",
            boxShadow: "inset 0 -1px 0 #ddd2bf",
            transformOrigin: "top center",
            transform: isOpening
              ? "perspective(500px) rotateX(-180deg)"
              : "perspective(500px) rotateX(0deg)",
            transition: isOpening
              ? "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
              : undefined,
          }}
        />
      </div>

      {/* Wax seal — centered at flap/body junction */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "calc(52% - 20px)",
          opacity: isOpening ? 0 : 1,
          transform: isOpening
            ? "translate(-50%, -2px) scale(0.8) rotate(15deg)"
            : "translate(-50%, 0) scale(1) rotate(0deg)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
          zIndex: 10,
        }}
        aria-hidden
      >
        <WaxSeal />
      </div>

    </div>
  );
}

function WaxSeal() {
  return (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-full"
      style={{
        background: "radial-gradient(circle at 38% 34%, #9a4683 0%, #7a2e63 55%, #5a1f48 100%)",
        boxShadow: "0 4px 10px -3px rgba(90,31,72,0.55), inset 0 0 0 3px rgba(255,255,255,0.08)",
      }}
    >
      {/* Monogram / flourish */}
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white/80" aria-hidden>
        <path
          d="M12 4c-1.5 2-3 5-3 8s1.5 6 3 8M12 4c1.5 2 3 5 3 8s-1.5 6-3 8M5 12h14"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
}
