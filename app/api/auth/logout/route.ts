import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout — always succeeds.
 *
 * Signing out is the one action that must never fail in a way that leaves a
 * learner stuck. On a shared phone this is the common case, not an edge case
 * (auth-onboarding spec §7): the next child needs the previous session gone.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
