import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * SERVICE-ROLE CLIENT — BYPASSES ROW LEVEL SECURITY.
 *
 * Every policy written in supabase/migrations is inert here. This client can
 * read any learner's data and can read `questions.answer_value`.
 *
 * Use it for exactly four things:
 *   1. Grading an attempt (reading answer_value — app/api/attempts)
 *   2. Calling the derived-state functions (mastery, streaks, milestones)
 *   3. Server-owned writes with no user session (the weekly summary cron)
 *   4. Aggregating `events` for /admin/metrics (lib/analytics/dashboard.ts).
 *      `events` has no read policy at all, for anybody — cross-learner counts
 *      are the one thing that legitimately needs to see past RLS, and that
 *      module returns counts only, never an id.
 *
 * Never import this file into a Client Component, and never reach for it to
 * make an RLS problem go away — that deletes the boundary instead of fixing it.
 */

// Hard runtime guard. If this module is ever pulled into a client bundle, the
// build or the page fails loudly here rather than quietly shipping the service
// key to a browser.
if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/admin.ts was imported into client code. The service-role key " +
      "must never reach a browser. Use lib/supabase/client.ts instead.",
  );
}

let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail loudly at first use rather than returning a client that 401s later.
  // A missing env var on Vercel is the classic deploy failure — this makes it
  // say so instead of surfacing as a mysterious empty result.
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. In production, add it in the " +
        "Vercel dashboard and redeploy — .env.local is not deployed.",
    );
  }

  cached = createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
