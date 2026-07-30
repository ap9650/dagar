import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * The plugin aliases `next-intl/config` to `./i18n/request.ts` by convention.
 * No `i18n` key on nextConfig — that is the Pages Router API and next-intl warns
 * about it. Saathi has no `[locale]` route segment (SCREENS.md route map); the
 * locale comes from a cookie instead.
 */
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
