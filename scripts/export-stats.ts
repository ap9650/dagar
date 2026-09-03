/**
 * npm run stats — the live counts the deck quotes, written to one file.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS.
 *
 * Every learner number on the deck used to be typed into `build-pitch.py` by
 * hand. They were correct on the day they were typed and wrong a week later,
 * and worse, they were wrong INCONSISTENTLY: the cover said 32 learners while
 * slide 20 said 46, on the same afternoon, in the same file. A reader who
 * catches that stops believing the other numbers, which is the real cost.
 *
 * So the deck reads `docs/deck/stats.json` instead. One query, one file, one
 * number per fact, regenerated before a build. Nothing is typed twice.
 *
 * Reads only. No learner is identified: this writes counts and nothing else.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** PostgREST caps a select at 1000 rows, so count with a head request. */
async function count(table: string) {
  const { count } = await db.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** Every row of one column, paged past the 1000-row cap. */
async function column<T>(table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from(table).select(select).range(from, from + 999);
    if (!data?.length) break;
    rows.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return rows;
}

const lessons = await column<{ student_id: string; completed_at: string | null }>(
  "lesson_progress", "student_id, completed_at",
);
const finished = lessons.filter((r) => r.completed_at);

const attempts = await column<{ student_id: string; is_correct: boolean }>(
  "attempts", "student_id, is_correct",
);

const tutor = await column<{ student_id: string; content: string }>(
  "tutor_messages", "student_id, content",
).then((rows) => rows);
const learnerTurns = (
  await db.from("tutor_messages").select("student_id, content").eq("role", "user")
).data ?? [];

// Column names come from the table, not from the CSV export's headers:
// the exporter renames `would_return` to `would_use_again` on the way out.
const feedback = await column<{
  understood: string; would_return: string; improve_most: string;
}>("product_feedback", "understood, would_return, improve_most");

const tally = (rows: { [k: string]: unknown }[], key: string) =>
  rows.reduce<Record<string, number>>((acc, r) => {
    const v = String(r[key] ?? "");
    if (v) acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});

const stats = {
  generated_at: new Date().toISOString(),
  learners_signed_up: await count("profiles"),
  learners_finished_lesson: new Set(finished.map((r) => r.student_id)).size,
  lessons_completed: finished.length,
  practice_attempts: attempts.length,
  practice_correct: attempts.filter((r) => r.is_correct).length,
  learners_practising: new Set(attempts.map((r) => r.student_id)).size,
  quiz_sessions: await count("quiz_sessions"),
  tutor_messages: learnerTurns.length,
  tutor_learners: new Set(learnerTurns.map((r) => r.student_id)).size,
  feedback_responses: feedback.length,
  feedback_understood: tally(feedback, "understood"),
  feedback_would_return: tally(feedback, "would_return"),
  feedback_improve_most: tally(feedback, "improve_most"),
  mentor_requests: await count("mentor_requests"),
};

mkdirSync("docs/deck", { recursive: true });
writeFileSync("docs/deck/stats.json", JSON.stringify(stats, null, 2) + "\n");

console.log(`wrote docs/deck/stats.json`);
console.log(`  ${stats.learners_signed_up} signed up · ` +
  `${stats.learners_finished_lesson} finished a lesson · ` +
  `${stats.lessons_completed} lessons · ${stats.practice_attempts} attempts`);
console.log(`  ${stats.feedback_responses} feedback · ` +
  `${stats.tutor_messages} tutor messages from ${stats.tutor_learners} learners`);
void tutor;
