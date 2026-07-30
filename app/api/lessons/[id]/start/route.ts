import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/security/authGuard";
import { track } from "@/lib/analytics/track";

/**
 * POST /api/lessons/[id]/start
 *
 * Idempotent. Reopening a lesson must not reset `started_at` — otherwise a
 * learner who dips back into lesson 1 for a reminder looks, in the data, like
 * someone who has just started it for the first time.
 *
 * `lesson_started` therefore fires on the FIRST start only.
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

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, status")
    .eq("student_id", auth.userId)
    .eq("lesson_id", id)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, started: false });

  // student_id comes from the session, never the body. RLS would reject anything
  // else anyway — this is the belt to that braces.
  const { error } = await supabase
    .from("lesson_progress")
    .insert({ student_id: auth.userId, lesson_id: id, status: "started" });

  if (error) {
    console.error("[lessons/start]", error.message);
    return NextResponse.json(
      { error: "Could not start the lesson", code: "START_FAILED" },
      { status: 500 },
    );
  }

  await track("lesson_started", { lesson_id: id });
  return NextResponse.json({ ok: true, started: true });
}
