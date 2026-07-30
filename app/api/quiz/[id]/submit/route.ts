import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { parseBody, quizSubmitSchema, zUuid } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";
import { gradeQuizSubmission } from "@/lib/learning/quiz";
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

  try {
    for (const conceptId of graded.conceptIds) {
      await admin.rpc("recompute_concept_mastery", {
        p_student_id: auth.userId,
        p_concept_id: conceptId,
      });
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

  // No PII, no free text: ids and numbers only (saathi-security §5).
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
  });
}
