/**
 * npm run check:progress — does every learner's progress screen agree with itself?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SCREEN, RECONSTRUCTED FROM THE REAL DATABASE.
 *
 * `tests/unit/progress-agreement.test.ts` asserts the same rule against
 * constructed activity. This is the live cohort, and it exists because the
 * constructed version can only ever test the code — it cannot test the rows.
 * Every progress bug so far was a row that had drifted, not a function that was
 * wrong, and the reports arrived from a phone rather than from CI.
 *
 * It builds the week strip and "What moved" the way `/progress` does, from the
 * two different tables they actually read, and flags any day that would render
 * a filled square with nothing beside it. Reads only.
 *
 * Run it after seeding, after a migration, and before a demo.
 *
 * ── EMAILS ARE MASKED ───────────────────────────────────────────────────────
 * Enough to recognise your own account, not enough to be a list of children's
 * addresses sitting in a terminal buffer. These are minors (security skill).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { weekOfActivity, daysMet } from "../lib/learning/week.ts";
import { buildDiary, entryDate, DIARY_EVENTS } from "../lib/learning/diary.ts";

nextEnv.loadEnvConfig(process.cwd());

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** `akritipanwar94@gmail.com` → `ak…r94@gmail.com`. Enough to recognise, not to reuse. */
const mask = (e: string) => {
  const [name, domain] = e.split("@");
  return `${name.slice(0, 2)}…${name.slice(-3)}@${domain}`;
};

const LONG = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monIndex = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;

/** Seeded by `npm run demo:data`, and the one account allowed to disagree. */
const DEMO_ACCOUNT = "demo@saathi.app";

const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) throw error;

let contradictory = 0;

for (const u of users.users) {
  const email = (u.email ?? "").toLowerCase();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, grade, locale")
    .eq("id", u.id)
    .maybeSingle();
  if (!profile || profile.role !== "student") continue;

  const [lp, at, streakRow, ev] = await Promise.all([
    admin.from("lesson_progress").select("completed_at").eq("student_id", u.id).eq("status", "completed"),
    admin.from("attempts").select("created_at").eq("student_id", u.id).eq("session_kind", "practice"),
    admin.from("streaks").select("current, grace_used_on").eq("student_id", u.id).maybeSingle(),
    admin
      .from("events")
      .select("name, props, created_at")
      .eq("student_id", u.id)
      .in("name", DIARY_EVENTS)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const week = weekOfActivity(
    (lp.data ?? []).map((r) => r.completed_at).filter((x): x is string => Boolean(x)),
    (at.data ?? []).map((r) => r.created_at),
    new Date(),
    streakRow.data?.grace_used_on ?? null,
  );
  const diary = buildDiary(ev.data ?? []);
  const byDay = new Map<string, number>();
  for (const e of diary) byDay.set(entryDate(e), (byDay.get(entryDate(e)) ?? 0) + 1);

  const bad = week.filter((d) => d.met && (byDay.get(d.date) ?? 0) === 0 && !d.isToday);

  console.log(`\n=== ${mask(email)} · class ${profile.grade} · ${profile.locale} ===`);
  for (const d of week) {
    const lines = byDay.get(d.date) ?? 0;
    if (!d.met && !d.isToday && !d.rested && lines === 0) continue;
    console.log(
      `    ${d.date} ${LONG[monIndex(d.date)]}  ${d.met ? "TICK " : d.isToday ? "today" : "rest "}  what-moved lines=${lines}${bad.includes(d) ? "   <<< TICK WITH NOTHING BESIDE IT" : ""}`,
    );
  }
  console.log(`    "${daysMet(week)} days this week" · "${streakRow.data?.current ?? 0} day streak"`);

  if (bad.length === 0) {
    console.log("    ✓ agrees with itself");
  } else if (email === DEMO_ACCOUNT) {
    // Known and accepted (D25): `demo-data.ts` seeds progress but deliberately
    // not events, so seeded activity never reaches the PRD's metrics. The cost
    // is exactly this contradiction, and it cannot happen to a real learner.
    console.log(`    ⚠ ${bad.length} contradictory day(s) — expected, this is the seeded demo account`);
    console.log("      Do not demo /progress from it. See DECISIONS.md D25.");
  } else {
    console.log(`    ✗ ${bad.length} contradictory day(s)`);
    contradictory++;
  }
}

console.log(
  contradictory === 0
    ? "\n✓ Every real learner's progress screen agrees with itself."
    : `\n✗ ${contradictory} real account(s) show a filled square with nothing beside it.`,
);
if (contradictory > 0) process.exitCode = 1;
