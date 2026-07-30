import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
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

/**
 * Metadata goes through the dictionary too. A learner sharing the app over
 * WhatsApp — which is how this spreads — gets a link preview in the language
 * they actually read.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
    // iOS ignores the web app manifest's icons entirely and uses this instead —
    // without it an installed Saathi on an iPhone gets a screenshot of the page
    // as its home-screen icon (D15, pwa-shell spec §2).
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "Saathi", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1,
  // Deliberately NOT setting maximumScale or userScalable: false. Blocking
  // pinch-zoom is an accessibility failure, and D10 requires text to reflow at
  // 200% zoom.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved in i18n/request.ts from the locale cookie. Server-rendered, so a
  // Hindi learner never sees a flash of English on first paint.
  const locale = await getLocale();

  return (
    <html
      // `lang` is doing real work here, not just accessibility: globals.css hangs
      // the whole Devanagari type scale (18px / 1.75) off `:lang(hi)`, and the
      // browser needs it for correct shaping. Both scripts are LTR, so no `dir`.
      lang={locale}
      className={`${inter.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* No props needed: rendered from a Server Component, the provider
            inherits locale, messages and time zone from i18n/request.ts. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
