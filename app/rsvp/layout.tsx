import { Cormorant_Garamond, DM_Sans, Great_Vibes } from "next/font/google";

const weddingScript = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-wedding-script",
  display: "swap",
});

const weddingSerif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-wedding-serif",
  display: "swap",
});

const weddingSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-wedding-sans",
  display: "swap",
});

export default function RsvpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${weddingScript.variable} ${weddingSerif.variable} ${weddingSans.variable} min-h-dvh bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#faf6ef_0%,#f0e6d8_45%,#ebe2d4_100%)] text-[#3d3429] antialiased`}
      style={{ fontFamily: "var(--font-wedding-sans), ui-sans-serif, system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
