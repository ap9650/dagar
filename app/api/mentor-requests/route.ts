import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { mentorRequestSchema, parseBody } from "@/lib/security/validation";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";
import { STRUGGLE_WINDOW } from "@/lib/learning/struggle";
import type { Json } from "@/lib/supabase/database.types";

/**
 * POST /api/mentor-requests — the learner accepts the "want a person to explain
 * this?" offer.
 *
 * Built here in 2.2 rather than left for 2.6 because 2.2 ships the CTA that
 * triggers it, and a button that 404s is worse than no button. Slice 2.6 adds
 * D6 rule 3 (tutor turns with no practice) and the transcript excerpt in
 * `context`; the shape below does not change.
 *
 * **Capture-only (D8).** There is no mentor-side UI in the MVP and `status` moves
 * by hand. The copy the learner sees must therefore promise a person, not a
 * timeframe.
 *
 * `context` is assembled SERVER-SIDE from real attempts. The schema deliberately
 * has no `context` field — accepting one would let a forged payload poison the
 * record a human is going to read.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // A learner spamming this floods a queue a human reads. Slow, not blocked.
  const limit = memoryLimit(`mentor:${auth.userId}`, 5, 600);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = await parseBody(request, mentorRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { concept_id, trigger, learner_note } = parsed.data;

  const supabase = await createClient();

  // What a mentor needs to be useful in thirty seconds: which questions, right or
  // wrong, how much help was already taken. Question SLUGS, never stems — the
  // stem is reproducible from the slug and the row stays small.
  let context: Json = {};

  if (concept_id) {
    const { data: recent } = await supabase
      .from("attempts")
      .select("question_id, is_correct, hints_used, created_at")
      .eq("student_id", auth.userId)
      .eq("concept_id", concept_id)
      .order("created_at", { ascending: false })
      .limit(STRUGGLE_WINDOW);

    context = {
      recent_attempts: (recent ?? []).map((attempt) => ({
        question_id: attempt.question_id,
        is_correct: attempt.is_correct,
        hints_used: attempt.hints_used,
        at: attempt.created_at,
      })),
    };
  }

  const { error } = await supabase.from("mentor_requests").insert({
    student_id: auth.userId,
    concept_id: concept_id ?? null,
    trigger,
    learner_note: learner_note ?? null,
    context,
  });

  if (error) {
    console.error("[mentor-requests]", error.message);
    return NextResponse.json(
      { error: "Could not send your request", code: "MENTOR_REQUEST_FAILED" },
      { status: 500 },
    );
  }

  // `trigger` only — never the note. A learner's free text does not belong in an
  // events table we aggregate and read (saathi-security §5).
  await track("mentor_request_submitted", { trigger });

  return NextResponse.json({ ok: true });
}
