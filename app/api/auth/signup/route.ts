import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBody, signupSchema } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";

/**
 * POST /api/auth/signup — email + password (D2 fallback path; Google is primary).
 *
 * Goes through a route handler rather than the browser client so there is a
 * server surface to rate-limit and log against (auth-onboarding spec §3).
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, signupSchema);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.data;

  // Keyed by the lowercased email (zod already lowercased it), not by IP: on a
  // shared phone or a school's NAT, many legitimate learners share one address.
  const limit = memoryLimit(`auth:signup:${email}`, LIMITS.auth.limit, LIMITS.auth.windowSeconds);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Supabase's message is shown verbatim here — unlike login, signup has to
    // tell you the address is taken or you cannot proceed. "User already
    // registered" is not a leak: whoever typed it can find out by trying to log
    // in anyway.
    return NextResponse.json(
      { error: error.message, code: "SIGNUP_FAILED" },
      { status: 400 },
    );
  }

  // With "Confirm email" ON in Supabase, signUp returns a user but NO session —
  // the learner is not signed in yet and must click a link in their inbox. The
  // client needs to know which of the two happened, or it redirects to a
  // dashboard the learner has no session for.
  return NextResponse.json({
    ok: true,
    needsConfirmation: data.session === null,
  });
}
