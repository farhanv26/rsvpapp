import type { Metadata } from "next";
import { Cormorant_Garamond, Dancing_Script, Geist_Mono, Great_Vibes, Public_Sans } from "next/font/google";
import "./globals.css";

const uiSans = Public_Sans({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
});

const uiMono = Geist_Mono({
  variable: "--font-ui-mono",
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
  title: { default: "VowPal", template: "%s · VowPal" },
  description: "Guests, invitations, replies, budget and vendors for every event of your wedding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${uiSans.variable} ${uiMono.variable} ${weddingScript.variable} ${weddingScriptAlt.variable} ${weddingSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {process.env.VOWPAL_DEMO === "1" ? (
          <aside role="status" className="bg-[var(--warning-soft)] px-4 py-3 text-center text-sm font-medium text-[var(--warning)]">
            Demo environment · Fictional accounts and wedding data. Your normal local account is at 127.0.0.1:3000.
          </aside>
        ) : null}
        {children}
      </body>
    </html>
  );
}
