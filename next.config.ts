import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Per the Next 16 PWA guide. The Cache-Control line is the important
        // one: a cached service worker is how a learner gets permanently stuck
        // on an old shell, because the file that would update it is itself
        // being served from cache.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

/**
 * The plugin aliases `next-intl/config` to `./i18n/request.ts` by convention.
 * No `i18n` key on nextConfig — that is the Pages Router API and next-intl warns
 * about it. Saathi has no `[locale]` route segment (SCREENS.md route map); the
 * locale comes from a cookie instead.
 */
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
