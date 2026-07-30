import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

/**
 * Two font families, one per script (saathi-design). Every font byte is data the
 * learner pays for, so both are subset and use `display: swap` — text renders
 * immediately in a fallback rather than leaving a blank screen on 4G.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saathi",
  description:
    "Your learning companion — NCERT mathematics for Classes 6 to 8, in English and Hindi.",
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1,
  // Deliberately NOT setting maximumScale or userScalable: false. Blocking
  // pinch-zoom is an accessibility failure, and D10 requires text to reflow at
  // 200% zoom.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
