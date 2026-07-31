import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/ is Playwright's — Vitest must not try to run those files.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "e2e"],
    environment: "node",
    // Integration tests hit the real Supabase project, so they need .env.local.
    setupFiles: ["tests/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // See tests/stubs/server-only.ts — the real package throws on import
      // outside a server context, which is right in Next and wrong in a test
      // runner. `next build` still resolves the real one.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
