"use client";

import { useEffect, useState } from "react";

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
  const [phase, setPhase] = useState<Phase>("pending");

  useEffect(() => {
    setPhase(skip ? "open" : "sealed");
  }, [skip]);

  function handleOpen() {
    setPhase("opening");
    setTimeout(() => setPhase("revealing"), 700);
    setTimeout(() => setPhase("open"), 1200);
  }

  // Avoid flash of envelope on server / hydration — match envelope background so there's no white flash
  if (phase === "pending") {
    return (
      <div
        className="min-h-dvh"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -10%, #faf6ef 0%, #f0e6d8 45%, #ebe2d4 100%)",
        }}
        aria-hidden
      />
    );
  }

  if (phase === "open") {
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
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% -10%, #faf6ef 0%, #f0e6d8 45%, #ebe2d4 100%)",
      }}
    >
      {/* Ambient glow behind envelope */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(178,137,68,0.14) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-[22rem] flex-col items-center">
        {/* For label */}
        {guestName ? (
          <p
            className="mb-5 text-center text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-zinc-400"
            style={{
              opacity: isOpening ? 0 : 1,
              transition: "opacity 0.4s ease",
            }}
          >
            For {guestName}
          </p>
        ) : null}

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
          <EnvelopeCard isOpening={isOpening} />
        </button>

        {/* Tap hint */}
        <p
          className="mt-5 text-center text-xs font-medium text-zinc-400 transition-all duration-300 group-hover:text-zinc-600"
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

function EnvelopeCard({ isOpening }: { isOpening: boolean }) {
  return (
    /* Envelope outer — cream card with warm shadow */
    <div
      className="relative w-full overflow-hidden rounded-3xl border-2 border-[#ddd0bc] bg-[#fdf9f2]"
      style={{
        aspectRatio: "1.6 / 1",
        boxShadow:
          "0 30px 80px -20px rgba(71,52,29,0.38), 0 4px 20px -8px rgba(71,52,29,0.18), inset 0 1px 0 rgba(255,255,255,0.7)",
        transition: "box-shadow 0.4s ease",
      }}
    >
      {/* Bottom-left fold triangle */}
      <div
        className="absolute bottom-0 left-0 h-0 w-0"
        style={{
          borderLeft: "clamp(80px,40%,160px) solid #f0e4cc",
          borderTop: "clamp(60px,32%,120px) solid transparent",
        }}
        aria-hidden
      />
      {/* Bottom-right fold triangle */}
      <div
        className="absolute bottom-0 right-0 h-0 w-0"
        style={{
          borderRight: "clamp(80px,40%,160px) solid #f0e4cc",
          borderTop: "clamp(60px,32%,120px) solid transparent",
        }}
        aria-hidden
      />

      {/* Gold inner border line */}
      <div
        className="pointer-events-none absolute inset-[6px] rounded-2xl border border-[#d4aa6a]/30"
        aria-hidden
      />

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
            background: "linear-gradient(175deg, #fdf5e4 0%, #e8d4aa 100%)",
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

      {/* Subtle inner lines (envelope back pattern) */}
      <div className="absolute inset-0 flex items-end justify-center pb-3 opacity-20" aria-hidden>
        <div className="h-px w-4/5 bg-gradient-to-r from-transparent via-[#c9a060] to-transparent" />
      </div>
    </div>
  );
}

function WaxSeal() {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#c19a44]/60"
      style={{
        background: "radial-gradient(circle at 35% 35%, #d4a843 0%, #9a6e22 100%)",
        boxShadow: "0 3px 12px -4px rgba(120,80,20,0.6), inset 0 1px 0 rgba(255,220,120,0.35)",
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
