import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The auth boundary for route handlers.
 *
 * Identity comes from the SERVER SESSION, never from the request body. A
 * `student_id` arriving in a POST is an impersonation vector — read it from
 * here instead, always.
 */

export type Guarded =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireAuth(): Promise<Guarded> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, userId: user.id };
}

/** Same, but also requires a profile of the given role. */
export async function requireRole(
  role: "student" | "parent",
): Promise<Guarded & { profile?: { id: string; role: string; grade: number | null; locale: string } }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, grade, locale")
    .eq("id", auth.userId)
    .single();

  if (!profile) {
    // Authenticated but no profile: onboarding was interrupted. This is a real
    // state, not an error — see docs/specs/auth-onboarding.md edge cases.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Profile not found", code: "NO_PROFILE" },
        { status: 409 },
      ),
    };
  }

  if (profile.role !== role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "WRONG_ROLE" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: auth.userId, profile };
}
