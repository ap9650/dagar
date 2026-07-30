/**
 * Vitest setup. Loads .env.local so integration tests can reach the real
 * Supabase project.
 *
 * Unit tests must NOT depend on this — everything in tests/unit is pure logic
 * with no network and no environment. If a unit test needs a key, it has stopped
 * being a unit test.
 */
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url).pathname;
if (existsSync(envPath)) {
  try {
    loadEnvFile(envPath);
  } catch {
    // Node < 20.12 lacks loadEnvFile. Integration tests will skip themselves.
  }
}

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
