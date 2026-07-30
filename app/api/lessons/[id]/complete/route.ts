import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { track } from "@/lib/analytics/track";
import { istDate } from "@/lib/learning/dates";

/**
 * POST /api/lessons/[id]/complete
 *
 * The order matters and is fixed by the spec: mark complete → recompute the
 * streak (D7) → award milestones (D7b) → tell the client what happened.
 *
 * **The client never tells the server what its streak is.** It asks the server to
 * record a completion, and the server replies with the truth. A client-supplied
 * streak is a number a learner can edit in devtools.
 *
 * Idempotent throughout: `unique(student_id, lesson_id)` on the progress row,
 * `extend_streak` returns early when today is already counted, and
 * `unique(student_id, code)` makes a re-award a no-op.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid lesson id", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Was this already complete? Decides whether the event fires, so it is read
  // before the write rather than inferred after it.
  const { data: before } = await supabase
    .from("lesson_progress")
    .select("status")
    .eq("student_id", auth.userId)
    .eq("lesson_id", id)
    .maybeSingle();

  const alreadyComplete = before?.status === "completed";

  const { error: writeError } = await supabase.from("lesson_progress").upsert(
    {
      student_id: auth.userId,
      lesson_id: id,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,lesson_id" },
  );

  if (writeError) {
    console.error("[lessons/complete]", writeError.message);
    return NextResponse.json(
      { error: "Could not save your progress", code: "COMPLETE_FAILED" },
      { status: 500 },
    );
  }

  if (alreadyComplete) {
    // Second call: nothing new happened. No event, no milestone, no streak bump.
    const { data: streak } = await supabase
      .from("streaks")
      .select("current")
      .eq("student_id", auth.userId)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      alreadyComplete: true,
      streak: streak?.current ?? 0,
      milestonesEarned: [],
    });
  }

  await track("lesson_completed", { lesson_id: id });

  // ── streak + milestones ──────────────────────────────────────────────────
  // Both are SECURITY DEFINER functions, so they run through the admin client.
  // Wrapped in try/catch on purpose: **completion is the source of truth and
  // stays** even if these fail (spec §7). Rolling back a finished lesson because
  // a streak query timed out would be the worse bug by a distance — it takes work
  // the learner actually did.
  const admin = createAdminClient();
  let streakDays = 0;
  let milestonesEarned: string[] = [];

  try {
    const today = istDate(); // the IST calendar date, never a UTC timestamp (D7)

    // Read BEFORE the RPC. Afterwards `last_active_date` is today either way —
    // whether this call extended the streak or the day was already counted — so
    // comparing after the fact cannot tell the two apart.
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

    // Fires only when the streak ACTUALLY moved. A second lesson on the same day
    // keeps the streak alive but does not extend it, and emitting the event
    // anyway would inflate the Day-7 retention metric with repeat activity.
    if (!dayAlreadyCounted && streakDays > 0) {
      await track("streak_extended", { days: streakDays });
    }

    const { data: awarded } = await admin.rpc("award_milestones", {
      p_student_id: auth.userId,
      p_context: { lesson_id: id },
    });
    milestonesEarned = awarded ?? [];

    for (const code of milestonesEarned) {
      await track("milestone_earned", { code });
    }
  } catch (error) {
    console.error("[lessons/complete] streak/milestones failed:", error);
    // Deliberately swallowed. The lesson is complete; these recompute on the
    // next write.
  }

  return NextResponse.json({
    ok: true,
    alreadyComplete: false,
    streak: streakDays,
    milestonesEarned,
  });
}
