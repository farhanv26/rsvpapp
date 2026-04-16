import type { Metadata } from "next";
import { Cormorant_Garamond, Dancing_Script, Geist, Geist_Mono, Great_Vibes, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displaySerif = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
});

const weddingScript = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-wedding-script",
  display: "swap",
});

const weddingScriptAlt = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-wedding-script-alt",
  display: "swap",
});

const weddingSerif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-wedding-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RSVP Event App",
  description: "Mobile-first RSVP management for multi-event guest lists.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} ${weddingScript.variable} ${weddingScriptAlt.variable} ${weddingSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900 flex flex-col">{children}</body>
    </html>
  );
}
