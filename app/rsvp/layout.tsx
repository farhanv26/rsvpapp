import { Cormorant_Garamond, Great_Vibes } from "next/font/google";

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

export default function RsvpLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${weddingScript.variable} ${weddingSerif.variable} invite min-h-dvh antialiased`}>{children}</div>;
}
