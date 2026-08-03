import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

/**
 * Playwright — the demo path only.
 *
 * One test that walks sign-up → dashboard → lesson → tutor → practice → quiz →
 * progress. If it is green, the demo works.
 */

// The dev server under `webServer` loads .env.local itself; the TEST process
// does not. One test needs to know the Supabase project ref to forge a session
// cookie with the name the client actually looks for. This is Next's own
// loader, so the test process reads exactly what the app reads — no second
// copy of the config to drift.
loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the demo path is one sequential journey
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "html",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // Learners are on shared Android phones — test at that size, not desktop.
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
