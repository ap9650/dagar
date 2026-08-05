import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";

/**
 * POST /api/push — remember where this browser can be reached.
 * DELETE /api/push — forget it.
 *
 * The `student_id` comes from the SESSION, never the body: a subscription
 * attributed to whoever the client says would let one learner point another
 * learner's reminders at their own device.
 *
 * Writes under the learner's own session so RLS is the boundary, not a filter
 * written here.
 */

const subscriptionSchema = z.object({
  // A push service URL. Length-capped because it is stored and indexed, and
  // https-only because a push endpoint never legitimately is not.
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const limit = memoryLimit(`push:${auth.userId}`, 20, 3600);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid subscription", code: "VALIDATION_FAILED" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Upsert on the ENDPOINT, which is the identity of a browser. The same
  // handset re-subscribing — after a permission reset, or a service-worker
  // update — must replace its row rather than accumulate one per visit.
  //
  // It also re-points the row at whoever is signed in now. On a shared family
  // phone that is the correct behaviour: the reminder should reach the child
  // currently using the app, not the sibling who granted permission last week.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      student_id: auth.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push] subscribe failed:", error.message);
    return NextResponse.json({ error: "Could not save", code: "PUSH_SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let endpoint: unknown;
  try {
    endpoint = (await request.json())?.endpoint;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return NextResponse.json({ error: "Missing endpoint", code: "BAD_REQUEST" }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS scopes this to the learner's own rows, so a stranger's endpoint cannot
  // be deleted even if it were guessed.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("student_id", auth.userId);

  if (error) {
    console.error("[push] unsubscribe failed:", error.message);
    return NextResponse.json({ error: "Could not remove", code: "PUSH_DELETE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
