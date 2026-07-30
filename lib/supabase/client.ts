"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase client for Client Components.
 *
 * Uses the anon key, so RLS applies — a learner can only ever read their own
 * rows, and `questions.answer_value` is unreachable from here by construction
 * (see supabase/migrations/0002_curriculum.sql). Read questions through
 * `questions_public`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
