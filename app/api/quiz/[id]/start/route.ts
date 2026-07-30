import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { zUuid } from "@/lib/security/validation";
import { LIMITS, memoryLimit, tooManyRequests } from "@/lib/security/rateLimiter";
import { startOrResumeQuiz } from "@/lib/learning/quiz";

/**
 * POST /api/quiz/[id]/start — open a chapter quiz, or rejoin an abandoned one.
 *
 * `[id]` is a CHAPTER id here and a SESSION id in the sibling `submit` route.
 * Next requires one slug name per path position, so the parameter cannot be
 * called `[chapterId]` in one and `[sessionId]` in the other as chapter-quiz.md
 * §3 writes them. The behaviour is the spec's; only the folder name differs.
 *
 * ── WHAT THIS RESPONSE CONTAINS ─────────────────────────────────────────────
 * Questions from `questions_public` — a view with no `answer_value` and no
 * `solution_md` column, and which strips `solution_md` out of every locale in
 * `i18n` too (migration 0012, written after that second path was found leaking).
 * Worked solutions reach the learner from `submit`, and nowhere else.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A POST rather than a GET because it can create a row. The quiz SCREEN does not
 * call this on render — a page that opens a session just by being looked at would
 * turn a mis-tap into a started quiz. The learner presses "Start the quiz".
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const limit = memoryLimit(
    `quiz-start:${auth.userId}`,
    LIMITS.attempts.limit,
    LIMITS.attempts.windowSeconds,
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const { id } = await params;
  if (!zUuid.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid chapter", code: "BAD_REQUEST" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const start = await startOrResumeQuiz({
      supabase,
      studentId: auth.userId,
      chapterId: id,
    });

    if (!start) {
      // No quiz questions seeded for this chapter. A real state while Classes 7
      // and 8 fill in, and not an error — the screen shows "coming soon".
      return NextResponse.json(
        { error: "No quiz for this chapter yet", code: "NO_QUESTIONS" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      session_id: start.sessionId,
      questions: start.questions,
    });
  } catch (error) {
    console.error("[quiz/start]", error);
    return NextResponse.json(
      { error: "Could not start the quiz", code: "QUIZ_START_FAILED" },
      { status: 500 },
    );
  }
}
