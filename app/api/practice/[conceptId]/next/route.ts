import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { zUuid } from "@/lib/security/validation";
import { selectPracticeQuestion } from "@/lib/learning/practice";

/**
 * GET /api/practice/[conceptId]/next?seen=<uuid>,<uuid>
 *
 * The next question for this learner on this concept, at the difficulty their
 * recent answers have earned (D3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RESPONSE CONTAINS NO ANSWER KEY, AND CANNOT.
 *
 * `selectPracticeQuestion` reads `questions_public`, a view whose column list
 * simply does not include `answer_value` or `solution_md`. There is no filtering
 * step here to forget. Verify it the way the spec asks — by opening the network
 * tab and reading the actual response body, not by reading this comment.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `seen` is the current session's questions. It is client-supplied and that is
 * fine: the worst a tampered value can do is change which question the learner is
 * offered next. It cannot affect grading, which happens in `POST /api/attempts`
 * against the service-role read of the key.
 */

const MAX_SEEN = 50;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conceptId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { conceptId } = await params;
  if (!zUuid.safeParse(conceptId).success) {
    return NextResponse.json(
      { error: "Invalid concept id", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  // Bounded and validated before it is used as a filter. An unbounded query string
  // is still input, even when it only steers question choice.
  const seenParam = new URL(request.url).searchParams.get("seen") ?? "";
  const seen = seenParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => z.string().uuid().safeParse(id).success)
    .slice(0, MAX_SEEN);

  const supabase = await createClient();

  const { question, ladder, bankSize } = await selectPracticeQuestion({
    supabase,
    studentId: auth.userId,
    conceptId,
    excludeIds: seen,
  });

  if (!question) {
    // No practice questions seeded for this concept. A real state — Classes 7 and
    // 8 have concepts whose banks land in a later content slice — and the screen
    // says so rather than showing an empty question card.
    return NextResponse.json(
      { question: null, difficulty: ladder.difficulty, bankSize: 0 },
      { status: 200 },
    );
  }

  return NextResponse.json({
    question,
    difficulty: ladder.difficulty,
    bankSize,
  });
}
