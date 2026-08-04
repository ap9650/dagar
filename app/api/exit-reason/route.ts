import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { EXIT_COOKIE, isExitReason } from "@/lib/exit";
import { LOCALE_COOKIE } from "@/i18n/config";

/**
 * POST /api/exit-reason — why a learner left, recorded after they have gone.
 *
 * ── UNAUTHENTICATED ON PURPOSE, GUARDED BY A ONE-TIME COOKIE ────────────────
 * There is no session here and there cannot be: the account was deleted before
 * this is called, which is what makes the answer anonymous rather than a note
 * attached to a named child (see `0023_exit_reasons.sql`).
 *
 * So the guard is the cookie the DELETE route set. It proves "this browser just
 * deleted an account", expires in thirty minutes, and is **cleared here** —
 * which also makes this endpoint one-shot per deletion. Without that clearing,
 * a bored learner could sit on `/welcome` and post two hundred reasons.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The reason is validated against a fixed list rather than trusted. Anything
 * else is a 400 and writes nothing — an enum column would reject it at the
 * database anyway, but failing here keeps the error legible.
 */
export async function POST(request: Request) {
  const store = await cookies();
  if (!store.get(EXIT_COOKIE)?.value) {
    // Not "forbidden" in any interesting sense: this browser has not just
    // deleted an account, so there is nothing to say goodbye about.
    return NextResponse.json({ error: "no_exit" }, { status: 403 });
  }

  let reason: unknown;
  try {
    reason = (await request.json())?.reason;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!isExitReason(reason)) {
    return NextResponse.json({ error: "bad_reason" }, { status: 400 });
  }

  const locale = store.get(LOCALE_COOKIE)?.value;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { error } = await admin.from("exit_reasons").insert({
    reason,
    locale: locale === "en" || locale === "hi" ? locale : null,
  });

  // A failure here is logged and swallowed. The learner has already deleted
  // their account and is on their way out; showing them an error about our
  // analytics would be the last thing Dagar ever said to them.
  if (error) console.error("[exit-reason] insert failed:", error.message);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(EXIT_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
