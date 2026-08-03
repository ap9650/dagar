import type { MetadataRoute } from "next";

/**
 * Web app manifest (D15) — what turns the URL into a home-screen app.
 *
 * There is no APK in the MVP: a Play developer account created after Nov 2023
 * must run a 14-day closed test with 12+ testers before it can even apply for
 * production access, which is longer than this entire build. A PWA installs from
 * the URL, opens full-screen with its own icon, and — post-buildathon — wraps
 * unchanged in a Trusted Web Activity for a real Play Store listing.
 *
 * Next serves this at /manifest.webmanifest; the root layout links it
 * automatically. Note that `proxy.ts` already excludes manifest.webmanifest and
 * icons from the auth matcher — running a session check on an icon request is
 * wasted latency on every launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dagar — Learn maths, step by step",
    // Home screens truncate hard. This is what actually appears under the icon.
    short_name: "Dagar",
    description:
      "Your learning companion. NCERT mathematics for Classes 6 to 8, in English and Hindi.",
    // `/learn`, not `/`. `/` renders nothing and exists only to redirect, so
    // launching through it meant a blank screen for a whole extra round trip
    // before the real one was even requested — measured at 500–800 ms, and it
    // is what a cold start felt like. A signed-out launch is redirected by
    // `proxy.ts`, which sends a learner with no locale cookie to the language
    // picker so D16's "language first" survives the change.
    start_url: "/learn",
    // No browser chrome — the thing that makes it feel like an app rather than
    // a bookmark.
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0F766E",
    // The app is bilingual and the learner chooses at /welcome, so the manifest
    // declares the base locale only. Both scripts are left-to-right.
    lang: "en",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Separate maskable entry with ~20% padding. Without it, a circular
      // Android launcher crops straight through the mark.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
