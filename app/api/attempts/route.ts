import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { attemptSchema, parseBody } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { track } from "@/lib/analytics/track";
import { gradeDetailed, type AnswerType } from "@/lib/learning/grading";
import { ladderFrom } from "@/lib/learning/adaptivity";
import { detectStruggle } from "@/lib/learning/struggle";
import { HINT_TIERS } from "@/lib/learning/hints";
import { PRACTICE_QUESTIONS_FOR_GOAL } from "@/lib/learning/dailyGoal";
import { conceptLevel } from "@/lib/learning/levels";
import { istDate, istDayStart } from "@/lib/learning/dates";
import { t as tContent } from "@/lib/i18n/content";
import type { Locale } from "@/i18n/config";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /api/attempts — WHERE PRACTICE IS GRADED, AGAINST THE ANSWER KEY.
 *
 * Three modules in Dagar read the base `questions` table, and they are the
 * complete list: this one, `POST /api/hints` (which needs the worked solution to
 * keep a hint mathematically honest), and `lib/learning/quiz.ts` (which grades a
 * submitted chapter quiz). All three are server-side, all three use the service
 * role, and none is reachable from a browser.
 *
 * Every other question read in the product goes through `questions_public`,
 * which has no `answer_value` column. Here the service-role client reads the
 * base table — after the learner has committed to an answer, server-side, in a
 * route the browser cannot inspect.
 *
 * `is_correct` is NEVER accepted from the request. `attemptSchema` has no such
 * field and zod strips unknown keys, so a client POSTing `is_correct: true` is
 * regraded and recorded exactly as wrong as it was.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The order below is fixed and each step depends on the one before it:
 *   grade → write the attempt → recompute mastery (D5) → extend the streak at the
 *   five-question threshold (D7) → award milestones (D7b) → evaluate struggle (D6)
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // Blocks a scripted submission loop. In-memory is the right tool: going over
  // this limit costs a database row, not an API bill (see rateLimiter.ts).
  const limit = memoryLimit(
    `attempts:${auth.userId}`,
    LIMITS.attempts.limit,
    LIMITS.attempts.windowSeconds,
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = await parseBody(request, attemptSchema);
  if (!parsed.ok) return parsed.response;

  const {
    question_id,
    given_answer,
    hints_used,
    ms_taken,
    session_kind,
    quiz_session_id,
    submission_id,
  } = parsed.data;

  const admin = createAdminClient();
  const locale = (await getLocale()) as Locale;

  // ── the answer key ───────────────────────────────────────────────────────
  const { data: question, error: questionError } = await admin
    .from("questions")
    .select("id, concept_id, chapter_id, answer_type, answer_value, solution_md, difficulty, i18n")
    .eq("id", question_id)
    .maybeSingle();

  if (questionError || !question) {
    return NextResponse.json(
      { error: "Question not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // ── grade (deterministic, no AI, no locale) ──────────────────────────────
  const result = gradeDetailed(
    question.answer_value,
    question.answer_type as AnswerType,
    given_answer,
  );

  if (result.reason === "empty") {
    // NO ATTEMPT ROW IS WRITTEN. A blank submission must never count against
    // mastery — spec §8, and the reason `gradeDetailed` distinguishes "empty"
    // from "wrong" at all. The client shows "Type your answer first".
    return NextResponse.json(
      { error: "Answer is empty", code: "EMPTY_ANSWER" },
      { status: 422 },
    );
  }

  const isCorrect = result.correct;

  // ── write the attempt, at most once per submission ───────────────────────
  //
  // A POST that grades and then loses its response on a bad connection is normal
  // for this audience, and the learner taps Check again. Without this, that retry
  // would spend two of their five mastery slots on one question (migration 0011).
  let duplicate = false;

  if (submission_id) {
    const { data: existing } = await admin
      .from("attempts")
      .select("id")
      .eq("student_id", auth.userId)
      .eq("submission_id", submission_id)
      .maybeSingle();
    duplicate = Boolean(existing);
  }

  if (!duplicate) {
    const { error: insertError } = await admin.from("attempts").insert({
      student_id: auth.userId,
      question_id: question.id,
      concept_id: question.concept_id,
      given_answer,
      is_correct: isCorrect,
      hints_used,
      ms_taken: ms_taken ?? null,
      session_kind,
      quiz_session_id: quiz_session_id ?? null,
      submission_id: submission_id ?? null,
    });

    if (insertError) {
      // 23505 = unique violation on attempts_submission_key: two submissions
      // raced. The row exists, which is exactly what we wanted — carry on and
      // report the same result rather than failing a learner's correct answer.
      if (insertError.code !== "23505") {
        console.error("[attempts] insert failed:", insertError.message);
        return NextResponse.json(
          { error: "Could not save your answer", code: "ATTEMPT_FAILED" },
          { status: 500 },
        );
      }
      duplicate = true;
    }
  }

  // ── derived state ────────────────────────────────────────────────────────
  //
  // Wrapped, like lesson completion: **the attempt is the source of truth and
  // stays** even if a recompute fails. Rejecting an answer a learner got right
  // because a streak query timed out is the worse bug by a distance.
  let masteryScore = 0;
  let masteryAttempts = 0;
  let masteryIsMastered = false;
  let streakDays = 0;
  let milestonesEarned: string[] = [];
  /**
   * Did THIS answer turn today into a counted day? See the same flag in
   * `lessons/[id]/complete` — on the practice side it can only become true on the
   * fifth distinct question of the day, which is precisely the moment the goal
   * ring closes.
   */
  let dayCounted = false;
  let showMentorCta = false;
  let mentorTrigger: string | null = null;

  try {
    /**
     * ── READ THE LEVEL BEFORE THE RECOMPUTE OVERWRITES IT ──────────────────
     * `concept_mastery` holds the current state and no history, so the fact
     * that a learner moved from "Getting there" to "Mastered" exists for one
     * instant — inside the RPC, between the select and the upsert — and is then
     * gone. Reading first is the only way to know a level changed at all, and
     * the diary on `/progress` has nothing to show without it.
     *
     * One extra select on the practice hot path, which is the price of the
     * screen being able to prove yesterday happened.
     */
    const { data: before } = await admin
      .from("concept_mastery")
      .select("score, attempts_count, is_mastered")
      .eq("student_id", auth.userId)
      .eq("concept_id", question.concept_id)
      .maybeSingle();

    const { data: mastery } = await admin.rpc("recompute_concept_mastery", {
      p_student_id: auth.userId,
      p_concept_id: question.concept_id,
    });

    if (mastery) {
      masteryScore = Number(mastery.score);
      masteryAttempts = mastery.attempts_count;
      masteryIsMastered = mastery.is_mastered;

      // Both directions. Mastery falls as well as rises and analytics should
      // see the truth; `/progress` shows only the rises, which is a decision
      // made where it belongs — in the screen, not in the record.
      const fromLevel = conceptLevel(before);
      const toLevel = conceptLevel({
        score: masteryScore,
        attempts_count: masteryAttempts,
        is_mastered: masteryIsMastered,
      });

      if (fromLevel !== toLevel) {
        await track("concept_level_changed", {
          concept_id: question.concept_id,
          from: fromLevel,
          to: toLevel,
        });
      }
    }

    // ── D7: five practice questions closes the day ─────────────────────────
    // Distinct QUESTIONS, not attempts. Answering one question five times is not
    // five questions of practice, and the daily goal ring must not be closable by
    // hammering Check on the same stem.
    if (session_kind === "practice") {
      const { data: todayRows } = await admin
        .from("attempts")
        .select("question_id")
        .eq("student_id", auth.userId)
        .eq("session_kind", "practice")
        .gte("created_at", istDayStart().toISOString());

      const distinctToday = new Set((todayRows ?? []).map((row) => row.question_id)).size;

      if (distinctToday >= PRACTICE_QUESTIONS_FOR_GOAL) {
        const today = istDate();

        // Read BEFORE the RPC: afterwards `last_active_date` is today whether or
        // not this call moved anything, so comparing after cannot tell the two
        // apart — the same trap as in lessons/complete.
        const { data: streakBefore } = await admin
          .from("streaks")
          .select("last_active_date")
          .eq("student_id", auth.userId)
          .maybeSingle();
        const dayAlreadyCounted = streakBefore?.last_active_date === today;

        const { data: streak } = await admin.rpc("extend_streak", {
          p_student_id: auth.userId,
          p_date: today,
        });
        streakDays = streak?.current ?? 0;

        if (!dayAlreadyCounted && streakDays > 0) {
          dayCounted = true;
          await track("streak_extended", { days: streakDays });
        }
      } else {
        const { data: streak } = await admin
          .from("streaks")
          .select("current")
          .eq("student_id", auth.userId)
          .maybeSingle();
        streakDays = streak?.current ?? 0;
      }
    }

    const { data: awarded } = await admin.rpc("award_milestones", {
      p_student_id: auth.userId,
      p_context: { concept_id: question.concept_id },
    });
    milestonesEarned = awarded ?? [];
    for (const code of milestonesEarned) await track("milestone_earned", { code });
  } catch (error) {
    console.error("[attempts] derived state failed:", error);
    // Swallowed on purpose. The attempt is recorded; these recompute on the next
    // write, and the learner keeps their answer.
  }

  // ── the difficulty ladder, and D6 ────────────────────────────────────────
  //
  // Both read the learner's own attempts through the RLS-scoped client rather than
  // the admin one. Nothing here needs to cross a user boundary, so nothing here
  // gets the ability to.
  let nextDifficulty = 1;

  try {
    const supabase = await createClient();
    const { data: conceptAttempts } = await supabase
      .from("attempts")
      .select("is_correct, hints_used, created_at")
      .eq("student_id", auth.userId)
      .eq("concept_id", question.concept_id)
      .order("created_at", { ascending: true });

    // The insert above is committed, so this attempt is already in `history` —
    // including on the duplicate path, where the earlier identical submission is.
    // That is why the ladder is folded from history rather than from history plus
    // "the one we just graded": a retry after a dropped response would otherwise
    // step the difficulty twice for one answer.
    const history = conceptAttempts ?? [];

    nextDifficulty = ladderFrom(history.map((a) => a.is_correct)).difficulty;

    const trigger = detectStruggle(
      history.map((a) => ({ is_correct: a.is_correct, hints_used: a.hints_used })),
      HINT_TIERS,
    );
    if (trigger) {
      showMentorCta = true;
      mentorTrigger = trigger;
    }
  } catch (error) {
    console.error("[attempts] ladder/struggle failed:", error);
  }

  // ── what the client is allowed to see ────────────────────────────────────
  //
  // Solutions and hints go out ONLY for practice. In a quiz the learner has more
  // questions ahead of them and answers are revealed on submit (2.4) — handing
  // over the worked solution mid-quiz would turn the quiz into an open book.
  const solutionLocalised = tContent(question, "solution_md", locale);
  const isPractice = session_kind === "practice";

  // The worked solution arrives once the learner has actually re-engaged: they
  // got it right, or they saw the hint and tried again. Returning it on the first
  // wrong answer would let a learner spend one deliberate miss to buy the full
  // working — cheap, and it teaches nothing.
  const revealSolution = isPractice && (isCorrect || hints_used >= HINT_TIERS);

  return NextResponse.json({
    is_correct: isCorrect,
    reason: result.reason,
    solution_md: revealSolution ? solutionLocalised : null,
    // No hint here. Hints are requested tier by tier from `POST /api/hints`
    // (slice 2.3) so the learner controls how much help they take — and so a
    // hint is only ever generated for someone who actually asked for one.
    next_difficulty: nextDifficulty,
    mastery: {
      score: masteryScore,
      attempts: masteryAttempts,
      is_mastered: masteryIsMastered,
    },
    streak: streakDays,
    dayCounted,
    milestonesEarned,
    showMentorCta,
    mentorTrigger,
  });
}
