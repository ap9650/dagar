/**
 * npm run check:streaks — does every stored streak match the days that earned it?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE INVARIANT, AGAINST REAL DATA.
 *
 * A streak is a stored counter, written once per qualifying day. The week
 * strip, the daily goal and the parent summary are all DERIVED from raw
 * activity on read. Two representations of one fact, updated by different code
 * paths — so any skipped write, or any timestamp that moves after the fact,
 * makes them disagree, and nothing in the product notices.
 *
 * It happened on 6 Aug: rereading a finished lesson restamped `completed_at`,
 * so a day qualified that the counter had never counted. A learner saw "2 days
 * this week" above "1 day streak" and reported it, which is not a way to find
 * bugs.
 *
 * This is that check, run on demand. `tests/unit/streak-invariant.test.ts` is
 * the same rule against constructed cases; this one is the real cohort.
 *
 * Reads only. `--fix` recomputes divergent rows from the activity, which is the
 * thing that actually happened and therefore the only honest repair.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { streakFromDays } from "../lib/learning/streaks.ts";
import { dayQualified } from "../lib/learning/week.ts";

nextEnv.loadEnvConfig(process.cwd());

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const FIX = process.argv.includes("--fix");

/** The IST calendar date of a timestamp. The same boundary D7 uses. */
const istDay = (at: string) =>
  new Date(new Date(at).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

const [{ data: lessons }, { data: practice }, { data: streaks }] = await Promise.all([
  admin.from("lesson_progress").select("student_id, completed_at").eq("status", "completed"),
  admin.from("attempts").select("student_id, created_at, question_id").eq("session_kind", "practice"),
  admin.from("streaks").select("student_id, current, longest, last_active_date, grace_used_on"),
]);

/** Per learner, per IST day: lessons finished and DISTINCT questions answered. */
const perLearner = new Map<string, Map<string, { lessons: number; questions: Set<string> }>>();
const day = (student: string, date: string) => {
  const days = perLearner.get(student) ?? new Map();
  perLearner.set(student, days);
  const d = days.get(date) ?? { lessons: 0, questions: new Set<string>() };
  days.set(date, d);
  return d;
};

for (const row of lessons ?? []) if (row.completed_at) day(row.student_id, istDay(row.completed_at)).lessons++;
for (const row of practice ?? []) day(row.student_id, istDay(row.created_at)).questions.add(row.question_id);

const stored = new Map((streaks ?? []).map((s) => [s.student_id, s]));

let checked = 0;
let diverged = 0;
let repaired = 0;

for (const [student, days] of perLearner) {
  // The SAME rule the streak, the week strip and the reminder cron all share.
  const qualifying = [...days.entries()]
    .filter(([, d]) => dayQualified(d.lessons, d.questions.size))
    .map(([date]) => date)
    .sort();

  if (qualifying.length === 0) continue;
  checked++;

  const truth = streakFromDays(qualifying)!;
  const row = stored.get(student);
  const mine = `${student.slice(0, 4)}…`;

  const agrees =
    row &&
    row.current === truth.current &&
    row.last_active_date === truth.lastActiveDate;

  if (agrees) continue;

  diverged++;
  console.log(
    `  ✗ ${mine} stored ${row ? `current=${row.current} last=${row.last_active_date}` : "NO ROW"}` +
      `  ·  activity says current=${truth.current} last=${truth.lastActiveDate}` +
      `  ·  ${qualifying.length} qualifying day(s)`,
  );

  if (FIX) {
    const { error } = await admin.from("streaks").upsert(
      {
        student_id: student,
        current: truth.current,
        longest: Math.max(truth.longest, row?.longest ?? 0),
        last_active_date: truth.lastActiveDate,
        grace_used_on: truth.graceUsedOn,
      },
      { onConflict: "student_id" },
    );
    if (error) console.error(`    could not repair: ${error.message}`);
    else {
      repaired++;
      console.log(`    repaired to current=${truth.current}`);
    }
  }
}

console.log("\nStreak invariant");
console.log(`  learners with activity : ${checked}`);
console.log(`  disagreements          : ${diverged}`);
if (FIX) console.log(`  repaired               : ${repaired}`);

if (diverged > 0 && !FIX) {
  console.log("\n✗ Stored streaks disagree with the activity behind them. Re-run with --fix.");
  process.exit(1);
}
console.log(diverged === 0 ? "\n✓ Every stored streak matches the days that earned it." : "");
