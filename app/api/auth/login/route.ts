import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, parseBody } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";

/** POST /api/auth/login — email + password. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.data;

  const limit = memoryLimit(`auth:login:${email}`, LIMITS.auth.limit, LIMITS.auth.windowSeconds);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // ONE generic message for every failure mode — wrong password, no such
    // account, unconfirmed email. Distinguishing them tells a stranger which
    // children have accounts here, which is exactly what we will not do.
    return NextResponse.json(
      { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
