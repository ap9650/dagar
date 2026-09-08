import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { parseBody, tutorFeedbackSchema } from "@/lib/security/validation";
import { track } from "@/lib/analytics/track";

/**
 * POST /api/tutor/feedback — one tap, no dialog.
 *
 * The highest-value eval signal in the product: a learner telling us an
 * explanation did not land, on the specific message that did not land. The
 * golden set (`evals/`) is built from these.
 *
 * Upsert on `(student_id, tutor_message_id)`, so tapping the other thumb
 * changes the verdict rather than failing on the unique index. Changing your
 * mind is not an error.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, tutorFeedbackSchema);
  if (!parsed.ok) return parsed.response;

  const { tutor_message_id, helpful } = parsed.data;
  const supabase = await createClient();

  // RLS-scoped: the policy on tutor_feedback checks `auth.uid() = student_id`,
  // so a learner cannot rate someone else's conversation even by guessing an id.
  const { error } = await supabase.from("tutor_feedback").upsert(
    {
      student_id: auth.userId,
      tutor_message_id,
      helpful,
    },
    { onConflict: "student_id,tutor_message_id" },
  );

  if (error) {
    console.error("[tutor/feedback]", error.message);
    return NextResponse.json(
      { error: "Could not save that", code: "FEEDBACK_FAILED" },
      { status: 500 },
    );
  }

  // `helpful` only. Never the message, never the learner's question — a
  // learner's free text does not belong in an events table (dagar-security §5).
  await track("tutor_feedback_given", { helpful });

  return NextResponse.json({ ok: true });
}
