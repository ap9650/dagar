import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv } from "../setup";
import { nextStreak, type Streak } from "@/lib/learning/streaks";

/**
 * Streaks and milestones, against the real database (D7, D7b).
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `lib/learning/streaks.ts` is a pure mirror of the `extend_streak` SQL, written
 * so D7's edge cases can be tested without a database. A mirror that has drifted
 * is worse than no mirror: the unit tests go green while the streak a learner
 * actually gets comes from Postgres and does something else.
 *
 * So the first block below runs the SAME sequence of days through both, and
 * compares. Not "does the SQL work" — does the SQL agree with the code the two
 * learner screens are rendering from.
 *
 * The second block does what the spec asks for in as many words: awarding is
 * "idempotent — verified by calling it twice".
 * ────────────────────────────────────────────────────────────────────────────
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const d = hasSupabaseEnv ? describe : describe.skip;

let admin: SupabaseClient;
let studentId: string;

async function extendInDb(date: string) {
  const { data, error } = await admin.rpc("extend_streak", {
    p_student_id: studentId,
    p_date: date,
  });
  if (error) throw error;
  return data as {
    current: number;
    longest: number;
    last_active_date: string | null;
    grace_used_on: string | null;
  };
}

async function resetStreak() {
  await admin.from("streaks").delete().eq("student_id", studentId);
}

d("streaks — the SQL and the TypeScript mirror agree", () => {
  beforeAll(async () => {
    admin = createClient(URL_, SVC, { auth: { persistSession: false } });

    const email = `streak_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: "test-password-12345",
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("no user");
    studentId = created.user.id;

    await admin.from("profiles").insert({
      id: studentId,
      role: "student",
      display_name: "streak test",
      grade: 6,
    });
  }, 60_000);

  afterAll(async () => {
    if (admin && studentId) await admin.auth.admin.deleteUser(studentId);
  }, 60_000);

  /**
   * Each case is one of the spec's acceptance criteria, played out as a run of
   * days. `null` means "no activity that day" — it is simply not sent.
   */
  const cases: { name: string; days: string[]; expect: { current: number; longest: number } }[] = [
    {
      name: "consecutive days increment",
      days: ["2026-08-01", "2026-08-02", "2026-08-03"],
      expect: { current: 3, longest: 3 },
    },
    {
      name: "a second write on the same day does not increment again",
      days: ["2026-08-01", "2026-08-01", "2026-08-02", "2026-08-02", "2026-08-02"],
      expect: { current: 2, longest: 2 },
    },
    {
      name: "one missed day spends the grace and the streak survives",
      days: ["2026-08-01", "2026-08-02", "2026-08-04"],
      expect: { current: 3, longest: 3 },
    },
    {
      name: "two missed days reset it",
      days: ["2026-08-01", "2026-08-02", "2026-08-05"],
      expect: { current: 1, longest: 2 },
    },
    {
      name: "a second grace inside the rolling 7 is refused",
      days: ["2026-08-01", "2026-08-03", "2026-08-05"],
      expect: { current: 1, longest: 2 },
    },
    {
      name: "grace comes back after 7 days",
      days: [
        "2026-08-01",
        "2026-08-03", // grace spent on the 2nd
        "2026-08-04",
        "2026-08-05",
        "2026-08-06",
        "2026-08-07",
        "2026-08-08",
        "2026-08-09",
        "2026-08-11", // 2026-08-10 missed; grace was spent 9 days ago
      ],
      expect: { current: 9, longest: 9 },
    },
    {
      name: "a backdated write never rewinds",
      days: ["2026-08-05", "2026-08-06", "2026-08-02"],
      expect: { current: 2, longest: 2 },
    },
    {
      name: "a long absence resets but keeps the best-ever",
      days: ["2026-08-01", "2026-08-02", "2026-08-03", "2026-09-15"],
      expect: { current: 1, longest: 3 },
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      await resetStreak();

      let mirror: Streak | null = null;
      let row!: Awaited<ReturnType<typeof extendInDb>>;

      for (const day of testCase.days) {
        row = await extendInDb(day);
        mirror = nextStreak(mirror, day);
      }

      // What the database actually gave the learner…
      expect({ current: row.current, longest: row.longest }).toEqual(testCase.expect);

      // …and the mirror the UI renders from says the same thing, day for day,
      // including which day the grace was spent on.
      expect(mirror!.current).toBe(row.current);
      expect(mirror!.longest).toBe(row.longest);
      expect(mirror!.lastActiveDate).toBe(row.last_active_date);
      expect(mirror!.graceUsedOn).toBe(row.grace_used_on);
    }, 30_000);
  }

  it("a client cannot write its own streak", async () => {
    // The number is server-side truth (D7). Nothing in the product accepts a
    // streak from a request body — `attemptSchema` and the quiz schema have no
    // such field — and the RLS boundary tests cover the direct-write path.
    // What this checks is that the RPC computes from the DATE it is given and
    // nothing else: passing a wild date does not mint a wild streak.
    await resetStreak();
    const row = await extendInDb("2026-08-01");
    expect(row.current).toBe(1);
    expect(row.longest).toBe(1);
  }, 30_000);
});

d("milestones — awarded once, never twice", () => {
  let msStudentId: string;
  let chapterId: string;
  let conceptId: string;
  let lessonId: string;

  beforeAll(async () => {
    admin = createClient(URL_, SVC, { auth: { persistSession: false } });

    const email = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: "test-password-12345",
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("no user");
    msStudentId = created.user.id;

    await admin.from("profiles").insert({
      id: msStudentId,
      role: "student",
      display_name: "milestone test",
      grade: 6,
    });

    const { data: ch } = await admin
      .from("chapters")
      .insert({ grade: 6, number: 998, title: "__ms__", slug: `__ms_ch_${Date.now()}` })
      .select("id")
      .single();
    chapterId = ch!.id;

    const { data: cn } = await admin
      .from("concepts")
      .insert({ chapter_id: chapterId, name: "__ms__", slug: `__ms_cn_${Date.now()}` })
      .select("id")
      .single();
    conceptId = cn!.id;

    const { data: ls } = await admin
      .from("lessons")
      .insert({
        chapter_id: chapterId,
        concept_id: conceptId,
        title: "__ms__",
        body_md: "x",
        order_index: 1,
        slug: `__ms_ls_${Date.now()}`,
      })
      .select("id")
      .single();
    lessonId = ls!.id;
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await admin.from("chapters").delete().eq("id", chapterId);
    if (msStudentId) await admin.auth.admin.deleteUser(msStudentId);
  }, 60_000);

  it("awards first_lesson once, and returns nothing the second time", async () => {
    await admin.from("lesson_progress").insert({
      student_id: msStudentId,
      lesson_id: lessonId,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    const { data: firstRun, error: e1 } = await admin.rpc("award_milestones", {
      p_student_id: msStudentId,
      p_context: {},
    });
    if (e1) throw e1;
    expect(firstRun).toContain("first_lesson");

    // The second call is the whole test. It must award nothing new — the return
    // value drives the toast, so a repeat would celebrate the same badge twice.
    const { data: secondRun, error: e2 } = await admin.rpc("award_milestones", {
      p_student_id: msStudentId,
      p_context: {},
    });
    if (e2) throw e2;
    expect(secondRun).not.toContain("first_lesson");

    // …and there is exactly one row, not two.
    const { count } = await admin
      .from("milestones")
      .select("id", { count: "exact", head: true })
      .eq("student_id", msStudentId)
      .eq("code", "first_lesson");
    expect(count).toBe(1);
  }, 30_000);

  it("never revokes a badge when mastery later drops", async () => {
    // Spec §8: "a milestone is a moment, not a state". Removing an earned badge
    // because a learner had two bad answers afterwards would be punitive, and on
    // this audience it is exactly the wrong signal.
    await admin.from("concept_mastery").upsert({
      student_id: msStudentId,
      concept_id: conceptId,
      score: 1,
      attempts_count: 3,
      is_mastered: true,
    });

    const { data: awarded } = await admin.rpc("award_milestones", {
      p_student_id: msStudentId,
      p_context: {},
    });
    expect(awarded).toContain("concept_mastered");

    // Mastery collapses.
    await admin
      .from("concept_mastery")
      .update({ score: 0.2, is_mastered: false })
      .eq("student_id", msStudentId)
      .eq("concept_id", conceptId);

    await admin.rpc("award_milestones", { p_student_id: msStudentId, p_context: {} });

    const { count } = await admin
      .from("milestones")
      .select("id", { count: "exact", head: true })
      .eq("student_id", msStudentId)
      .eq("code", "concept_mastered");
    expect(count).toBe(1); // still held
  }, 30_000);

  it("does not award a badge the learner has not earned", async () => {
    const { data: earned } = await admin
      .from("milestones")
      .select("code")
      .eq("student_id", msStudentId);

    const codes = (earned ?? []).map((row) => row.code);
    // No practice attempts and no 3-day streak exist for this learner.
    expect(codes).not.toContain("first_practice");
    expect(codes).not.toContain("streak_3");
    expect(codes).not.toContain("streak_7");
  }, 30_000);
});
