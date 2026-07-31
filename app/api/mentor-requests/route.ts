import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { mentorRequestSchema, parseBody } from "@/lib/security/validation";
import { memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";
import { buildMentorContext } from "@/lib/learning/mentorContext";

/**
 * POST /api/mentor-requests — the learner accepts the "want a person to explain
 * this?" offer.
 *
 * **Capture-only (D8).** There is no mentor-side UI in the MVP and `status` moves
 * by hand. The copy the learner sees therefore promises a person, not a
 * timeframe — an app that says "someone will reply shortly" and then does not is
 * worse than one that never offered.
 *
 * `context` is assembled SERVER-SIDE by `buildMentorContext`. The schema
 * deliberately has no `context` field: this is the one place in the product
 * where data reaches a human directly rather than through a screen, and a forged
 * payload would poison the record they act on.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // A learner spamming this floods a queue a human reads. Slow, not blocked.
  const limit = memoryLimit(`mentor:${auth.userId}`, 5, 600);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = await parseBody(request, mentorRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { concept_id, lesson_id, trigger, learner_note } = parsed.data;

  const supabase = await createClient();

  const context = await buildMentorContext({
    supabase,
    studentId: auth.userId,
    conceptId: concept_id,
    lessonId: lesson_id,
    trigger,
  });

  // ── one open request per concept (spec §7) ───────────────────────────────
  //
  // A learner who is stuck enough to ask twice is stuck; they are not two
  // people with two problems. Two open rows for the same concept means a mentor
  // reads the same story twice and the second copy is the stale one — so the
  // existing request is REFRESHED with the newer context instead.
  //
  // Scoped to `status = 'open'`. A request already acknowledged or resolved is a
  // closed episode, and a learner getting stuck again next week deserves a new
  // one rather than having their old thread reopened underneath a mentor.
  const existingQuery = supabase
    .from("mentor_requests")
    .select("id")
    .eq("student_id", auth.userId)
    .eq("status", "open")
    .limit(1);

  const { data: existing } = concept_id
    ? await existingQuery.eq("concept_id", concept_id).maybeSingle()
    : await existingQuery.is("concept_id", null).eq("trigger", trigger).maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("mentor_requests")
      .update({
        trigger,
        context,
        // Only overwrite the note if they wrote a new one. A learner who
        // explained themselves the first time should not lose it by tapping
        // the button again without typing.
        ...(learner_note ? { learner_note } : {}),
      })
      .eq("id", existing.id)
      .eq("student_id", auth.userId);

    if (error) {
      console.error("[mentor-requests] update failed:", error.message);
      return NextResponse.json(
        { error: "Could not send your request", code: "MENTOR_REQUEST_FAILED" },
        { status: 500 },
      );
    }

    // No second event. The metric counts learners who asked for a person, and
    // counting the same episode twice would overstate the one number this
    // feature reports.
    return NextResponse.json({ ok: true, id: existing.id, updated: true });
  }

  const { data: created, error } = await supabase
    .from("mentor_requests")
    .insert({
      student_id: auth.userId,
      concept_id: concept_id ?? null,
      trigger,
      learner_note: learner_note ?? null,
      context,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[mentor-requests]", error.message);
    return NextResponse.json(
      { error: "Could not send your request", code: "MENTOR_REQUEST_FAILED" },
      { status: 500 },
    );
  }

  // `trigger` only — never the note, never the answers. A learner's free text
  // does not belong in an events table we aggregate and read (saathi-security §5).
  await track("mentor_request_submitted", { trigger });

  return NextResponse.json({ ok: true, id: created.id, updated: false });
}
