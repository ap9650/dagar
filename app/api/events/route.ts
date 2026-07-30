import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/security/authGuard";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";

/**
 * POST /api/events — the ONE way a client component records an event.
 *
 * `lib/analytics/track.ts` is `server-only`, deliberately: `student_id` comes from
 * the session there, never from an argument. This route is the bridge for the
 * handful of events that genuinely happen in the browser — entering a practice
 * set, finishing one — and it keeps the same guarantee, because it calls the very
 * same `track()`.
 *
 * **The allowlist is the point.** `EventName` already makes an off-list name a
 * compile error server-side, but this route takes its name from a request body,
 * where the type system cannot help. Without the list below, anyone could POST
 * `lesson_completed` a thousand times and the Day-7 retention metric on the demo
 * slide would be fiction. Only events a browser is the rightful source of are
 * listed; everything derived — completions, streaks, milestones — is emitted by
 * the route handler that performed the write, where it cannot be faked.
 */
const CLIENT_EVENTS = ["practice_started", "practice_completed"] as const;

const eventSchema = z.object({
  name: z.enum(CLIENT_EVENTS),
  props: z
    .record(z.string().max(40), z.union([z.string().max(64), z.number(), z.boolean()]))
    .optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // Cheap in-memory limit: this route writes a row per call and nothing else, so
  // capping the flood is enough. It costs no money, so dbLimit would be overkill.
  const limit = memoryLimit(`events:${auth.userId}`, 60, 60);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event", code: "VALIDATION_FAILED" }, { status: 400 });
  }

  // track() scrubs PII keys and fails open on its own.
  await track(parsed.data.name, parsed.data.props ?? {});

  return NextResponse.json({ ok: true });
}
