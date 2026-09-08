import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { parseBody, quizSubmitSchema, zUuid } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";
import { gradeQuizSubmission } from "@/lib/learning/quiz";
import { detectStruggle } from "@/lib/learning/struggle";
import { HINT_TIERS } from "@/lib/learning/hints";
import { conceptLevel } from "@/lib/learning/levels";
import { t as tContent } from "@/lib/i18n/content";
import type { Locale } from "@/i18n/config";

/**
 * POST /api/quiz/[id]/submit — grade a whole quiz. `[id]` is the SESSION id.
 *
 * ── EVERY ANSWER IS REGRADED HERE ───────────────────────────────────────────
 * The request carries answers and nothing else. `quizSubmitSchema` has no
 * `score`, no `is_correct`, no `band`, and zod strips unknown keys — a client
 * that posts a perfect score has it dropped before this handler sees the body.
 * The grade comes from `answer_value` on the service-role read inside
 * `gradeQuizSubmission`, exactly as practice does in `POST /api/attempts`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The order is fixed and each step needs the one before it:
 *   grade the set → claim the session (atomically, once) → write one attempt per
 *   ANSWERED question → recompute mastery per concept (D5) → award milestones
 *   (D7b, where `chapter_mastered` lives) → emit `quiz_submitted`
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const limit = memoryLimit(
    `quiz-submit:${auth.userId}`,
    LIMITS.attempts.limit,
    LIMITS.attempts.windowSeconds,
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { id: sessionId } = await params;
  if (!zUuid.safeParse(sessionId).success) {
    return NextResponse.json({ error: "Invalid session", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = await parseBody(request, quizSubmitSchema);
  if (!parsed.ok) return parsed.response;

  const locale = (await getLocale()) as Locale;
  const admin = createAdminClient();

  const graded = await gradeQuizSubmission({
    admin,
    studentId: auth.userId,
    sessionId,
    answers: parsed.data.answers,
    // Solutions only. `answer_value` is never translated (D16), so grading is
    // byte-identical in Hindi and English.
    localiseSolution: (question) => tContent(question, "solution_md", locale),
  });

  if (!graded) {
    return NextResponse.json({ error: "Quiz not found", code: "NOT_FOUND" }, { status: 404 });
  }

  // A duplicate submit — the network dropped the first response and the learner
  // (or the client's retry) sent it again. The stored score comes back, nothing
  // is written twice, and no second `quiz_submitted` is emitted.
  if (graded.alreadySubmitted) {
    return NextResponse.json({
      session_id: sessionId,
      score: graded.score,
      total: graded.total,
      band: graded.band,
      perQuestion: graded.perQuestion,
      milestonesEarned: [],
    });
  }

  // ── derived state ────────────────────────────────────────────────────────
  //
  // Wrapped, like practice: the attempts and the score are already written and
  // they STAY, even if a recompute fails. Losing a completed quiz because a
  // mastery query timed out is the worse bug by a distance, and everything here
  // recomputes on the learner's next write anyway.
  let milestonesEarned: string[] = [];
  let mentorTrigger: string | null = null;
  let mentorConceptId: string | null = null;

  try {
    /**
     * The same before/after read as the practice route, and for the same
     * reason: `concept_mastery` keeps no history, so a level change exists only
     * in the gap between these two calls. A quiz can move several concepts at
     * once — it is the one moment in the product where a learner's whole
     * chapter standing can shift — so leaving it out would mean the diary
     * silently skipped the biggest day a learner has.
     *
     * Read in one query rather than per concept: a chapter quiz touches every
     * concept in the chapter, and a select each would be four round trips
     * inside a request the learner is waiting on.
     */
    const { data: beforeRows } = await admin
      .from("concept_mastery")
      .select("concept_id, score, attempts_count, is_mastered")
      .eq("student_id", auth.userId)
      .in("concept_id", graded.conceptIds);

    const before = new Map((beforeRows ?? []).map((row) => [row.concept_id, row]));

    for (const conceptId of graded.conceptIds) {
      const { data: after } = await admin.rpc("recompute_concept_mastery", {
        p_student_id: auth.userId,
        p_concept_id: conceptId,
      });
      if (!after) continue;

      const fromLevel = conceptLevel(before.get(conceptId));
      const toLevel = conceptLevel({
        score: Number(after.score),
        attempts_count: after.attempts_count,
        is_mastered: after.is_mastered,
      });

      if (fromLevel !== toLevel) {
        await track("concept_level_changed", {
          concept_id: conceptId,
          from: fromLevel,
          to: toLevel,
        });
      }
    }

    // Runs AFTER every concept is recomputed, not inside the loop: `chapter_mastered`
    // asks whether every concept in the chapter is mastered, and asking that
    // halfway through the recompute would read a chapter that is only partly
    // up to date.
    const { data: awarded } = await admin.rpc("award_milestones", {
      p_student_id: auth.userId,
      p_context: { chapter_id: graded.chapterId },
    });
    milestonesEarned = awarded ?? [];
    for (const code of milestonesEarned) await track("milestone_earned", { code });
  } catch (error) {
    console.error("[quiz/submit] derived state failed:", error);
  }

  // ── D6, evaluated HERE and not during the quiz (mentor-request.md §7) ─────
  //
  // "Do not interrupt a quiz. Surface the CTA on the results screen instead."
  // Three wrong in a row is ordinary inside a quiz — that is what a quiz is for
  // — and putting "want a person to explain this?" in front of a learner on
  // question four would be the app telling them they are failing while they are
  // still sitting the thing.
  //
  // The attempts are already written, so by the time this runs the quiz's own
  // answers are part of the history D6 reads.
  try {
    const supabase = await createClient();

    for (const conceptId of graded.conceptIds) {
      const { data: conceptAttempts } = await supabase
        .from("attempts")
        .select("is_correct, hints_used, created_at")
        .eq("student_id", auth.userId)
        .eq("concept_id", conceptId)
        .order("created_at", { ascending: true });

      const trigger = detectStruggle(
        (conceptAttempts ?? []).map((a) => ({
          is_correct: a.is_correct,
          hints_used: a.hints_used,
        })),
        HINT_TIERS,
      );

      // First trigger wins, one CTA, one request (spec §7). Concepts are checked
      // in the order they appeared in the quiz, so the offer lands on the one
      // they met first rather than whichever the database returned first.
      if (trigger) {
        mentorTrigger = trigger;
        mentorConceptId = conceptId;
        break;
      }
    }
  } catch (error) {
    console.error("[quiz/submit] struggle check failed:", error);
  }

  // No PII, no free text: ids and numbers only (dagar-security §5).
  await track("quiz_submitted", {
    chapter_id: graded.chapterId,
    score: graded.score,
    total: graded.total,
    band: graded.band,
  });

  return NextResponse.json({
    session_id: sessionId,
    score: graded.score,
    total: graded.total,
    band: graded.band,
    perQuestion: graded.perQuestion,
    milestonesEarned,
    showMentorCta: mentorTrigger !== null,
    mentorTrigger,
    mentorConceptId,
  });
}
