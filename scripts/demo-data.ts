/**
 * npm run demo:data — purge development junk, then seed one believable learner.
 *
 * IDEMPOTENT. Re-running resets the demo learner to the same state rather than
 * stacking more progress on top, so you can rehearse, make a mess, and reset.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT SEEDS LEARNER STATE. IT DOES NOT FABRICATE ANALYTICS EVENTS.
 *
 * Progress, mastery, streaks and badges are seeded, because a demo account that
 * looks brand new makes a four-day-old product look like a prototype.
 *
 * `events` rows are NOT seeded, and that line is deliberate. Those rows are what
 * the PRD's success metrics are computed from. Inventing them would mean quoting
 * an activation rate to judges that describes a script rather than a person —
 * and once you have done that you cannot tell your real numbers from your
 * decorative ones. The demo account will emit real events as you demo it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mastery, streaks and milestones are produced by calling the SAME database
 * functions the app calls, never by writing the rows directly. Hand-written
 * mastery would let the demo show a state the real engine cannot produce — which
 * is the one bug guaranteed to surface while somebody is watching.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";

// ─── env ─────────────────────────────────────────────────────────────────────
// Same loader as scripts/seed.ts — a plain node script, nothing has loaded
// .env.local for us.
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return process.env as Record<string, string>;
  }
  for (const line of raw.split("\n")) {
    if (!/^[A-Z]/.test(line)) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq)] = line
      .slice(eq + 1)
      .replace(/\s+#.*$/, "")
      .trim();
  }
  return { ...out, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

/**
 * Accounts created by tests and by development, matched on the address.
 *
 * Every automated suite in this repo mints users with one of these prefixes, so
 * a demo that follows a test run is not polluted by it.
 */
const JUNK_EMAIL_PATTERNS = [
  /@saathi\.test$/i, // slice 1.1 verification, Day 1
  /^e2e_/i, // playwright demo path
  /^rls_/i, // tests/integration/rls.test.ts
  /^privacy_/i, // tests/integration/privacy-promise.test.ts
  /^budget_/i, // tests/integration/ai-budget.test.ts
];

const DEMO_EMAIL = env.DEMO_EMAIL ?? "demo@saathi.app";

async function purge() {
  console.log("\n── purging development data ──────────────────────────────");

  const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const junk = list.users.filter(
    (u) => u.email && u.email !== DEMO_EMAIL && JUNK_EMAIL_PATTERNS.some((re) => re.test(u.email!)),
  );

  if (junk.length === 0) {
    console.log("   no test accounts found");
  }

  for (const user of junk) {
    // Events FIRST, and this ordering is the whole point.
    //
    // `events.student_id` is `on delete set null`, so deleting the user leaves
    // the event row behind with a null owner — still counted, no longer
    // attributable, impossible to find later. A dozen `learner_registered` rows
    // from Day 1 verification would quietly inflate the activation rate on a
    // metrics slide, which is the number most likely to be read aloud.
    const { count } = await db
      .from("events")
      .delete({ count: "exact" })
      .eq("student_id", user.id);

    await db.auth.admin.deleteUser(user.id);
    console.log(`   removed ${user.email}  (+${count ?? 0} events)`);
  }

  // Orphans from users deleted BEFORE this script existed — same inflation, and
  // by definition they belong to accounts that no longer exist.
  const { count: orphans } = await db
    .from("events")
    .delete({ count: "exact" })
    .is("student_id", null);

  if (orphans) console.log(`   removed ${orphans} orphaned events from earlier deletions`);
}

async function seedDemoLearner() {
  console.log("\n── seeding the demo learner ──────────────────────────────");

  // A generated password, printed once. Never a literal in the repo: this
  // account is reachable on the public deployment.
  const password = env.DEMO_PASSWORD ?? `demo-${randomBytes(9).toString("base64url")}`;

  const { data: existing } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = existing.users.find((u) => u.email === DEMO_EMAIL);

  if (user) {
    // Reset rather than duplicate: wipe the learner state and rebuild it, so a
    // rehearsal that got messy returns to a known screen.
    for (const table of [
      "attempts",
      "lesson_progress",
      "quiz_sessions",
      "concept_mastery",
      "milestones",
      "streaks",
      "tutor_messages",
      "events",
    ] as const) {
      await db.from(table).delete().eq("student_id", user.id);
    }
    await db.auth.admin.updateUserById(user.id, { password });
    console.log(`   reset ${DEMO_EMAIL}`);
  } else {
    const { data: created, error } = await db.auth.admin.createUser({
      email: DEMO_EMAIL,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("could not create the demo user");
    user = created.user;
    console.log(`   created ${DEMO_EMAIL}`);
  }

  const studentId = user.id;

  await db.from("profiles").upsert({
    id: studentId,
    role: "student",
    display_name: "Riya",
    grade: 6,
    locale: "en",
  });

  // ── the chapter ───────────────────────────────────────────────────────────
  const { data: chapter } = await db
    .from("chapters")
    .select("id, slug")
    .eq("grade", 6)
    .order("slug")
    .limit(1)
    .maybeSingle();
  if (!chapter) throw new Error("no Class 6 chapter — run npm run seed first");

  const { data: lessons } = await db
    .from("lessons")
    .select("id, concept_id, slug")
    .eq("chapter_id", chapter.id)
    .order("slug");
  const { data: concepts } = await db
    .from("concepts")
    .select("id, slug")
    .eq("chapter_id", chapter.id)
    .order("slug");

  if (!lessons?.length || !concepts?.length) throw new Error("chapter has no content");

  /**
   * Everything is dated to the PAST, and today is left deliberately empty.
   *
   * The first version stamped it all with now(), and the dashboard greeted the
   * demo account with "Done for today!" — the daily goal already closed. That is
   * the wrong screen to open a demo on: it removes the single best live moment
   * the product has, where finishing one lesson closes the ring and pushes the
   * streak up in the same breath.
   *
   * So the learner arrives mid-habit with today still open: a 4-day streak
   * behind them, nothing done yet. One tap on stage completes the goal AND
   * extends the streak to 5, in front of the audience, using real code.
   */
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  // Three of five lessons done — mid-chapter, which is the state that shows a
  // journey path with something behind it and something ahead of it.
  const done = lessons.slice(0, 3);
  for (const [i, lesson] of done.entries()) {
    await db.from("lesson_progress").upsert(
      {
        student_id: studentId,
        lesson_id: lesson.id,
        status: "completed",
        // Spread across the streak, not all in one implausible burst.
        completed_at: daysAgo(4 - i).toISOString(),
      },
      { onConflict: "student_id,lesson_id" },
    );
  }
  console.log(`   ${done.length} of ${lessons.length} lessons complete`);

  // ── attempts, shaped so the REAL mastery engine produces the bands we want ──
  //
  // D5 reads the last five attempts per concept: ≥80% mastered, ≥50% developing.
  // The patterns below are chosen to LAND on one of each rather than asserting a
  // band directly — if the engine ever changes, the demo changes with it instead
  // of quietly disagreeing with the product.
  //
  // ── ordered by TEACHING order, not by slug ────────────────────────────────
  // The first version ordered concepts alphabetically by slug and produced a
  // learner who had mastered "Adding and Subtracting Fractions" — lesson 5
  // material she has not reached — while still on "Keep practising" for
  // "Fraction Basics". Nobody learns in that order, and a demo that shows an
  // impossible learner undermines the exact claim it is there to support.
  //
  // So concepts are ordered by where they first appear in the lesson sequence:
  // strong at the start where she has been, weak at the end where she has not.
  // That also makes the recommendation engine point at a plausible next thing,
  // because it selects on the weakest concept.
  const orderedConcepts = [
    ...new Map(
      lessons
        .map((l) => concepts.find((c) => c.id === l.concept_id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => [c.id, c] as const),
    ).values(),
  ];
  for (const c of concepts) {
    if (!orderedConcepts.some((o) => o.id === c.id)) orderedConcepts.push(c);
  }

  const shapes: Record<number, boolean[]> = {
    0: [true, true, true, true, true], // mastered — the ground she has covered
    1: [true, true, true, false, true], // mastered (4/5)
    2: [true, false, true, false, true], // developing (3/5) — the current lesson
    3: [false, true, false, false, false], // needs revision (1/5) — not there yet
  };

  let attemptCount = 0;
  for (const [index, concept] of orderedConcepts.entries()) {
    const pattern = shapes[index] ?? [true, false, true, false, true];

    const { data: questions } = await db
      .from("questions")
      .select("id")
      .eq("concept_id", concept.id)
      .limit(pattern.length);
    if (!questions?.length) continue;

    for (const [i, correct] of pattern.entries()) {
      const question = questions[i % questions.length];
      // Errors are CHECKED, not counted past. The first version of this script
      // incremented `attemptCount` without looking, printed "20 attempts", and
      // produced an empty mastery table — the count described the loop, not the
      // database.
      const { error } = await db.from("attempts").insert({
        student_id: studentId,
        question_id: question.id,
        concept_id: concept.id,
        given_answer: correct ? "correct-demo" : "wrong-demo",
        is_correct: correct,
        session_kind: "practice",
        hints_used: correct ? 0 : 1,
        // Yesterday and before — today stays empty so the daily goal is open.
        created_at: daysAgo(1 + (i % 3)).toISOString(),
      });
      if (error) throw new Error(`attempts insert failed: ${error.message}`);
      attemptCount++;
    }

    // The app's own function, not a hand-written row.
    const { error: masteryError } = await db.rpc("recompute_concept_mastery", {
      p_student_id: studentId,
      p_concept_id: concept.id,
    });
    if (masteryError) throw new Error(`recompute_concept_mastery: ${masteryError.message}`);
  }
  console.log(`   ${attemptCount} attempts across ${orderedConcepts.length} concepts`);

  // ── a four-day streak ENDING YESTERDAY, built the way the app builds one ──
  // Ending yesterday, not today: the streak reads 4 and is still alive, and the
  // first lesson finished on stage takes it to 5.
  for (let n = 4; n >= 1; n--) {
    const { error } = await db.rpc("extend_streak", {
      p_student_id: studentId,
      p_date: daysAgo(n).toISOString().slice(0, 10),
    });
    if (error) throw new Error(`extend_streak: ${error.message}`);
  }

  const { data: badges } = await db.rpc("award_milestones", { p_student_id: studentId });

  const { data: streak } = await db
    .from("streaks")
    .select("current, longest")
    .eq("student_id", studentId)
    .maybeSingle();

  // `band` is NOT a column. concept_mastery stores `score` and `is_mastered`;
  // the band is derived in lib/learning/mastery.ts. Selecting a column that does
  // not exist returns an error, not rows — and the first version of this line
  // ignored that error and printed an empty summary while the data was fine.
  const { data: mastery, error: masteryReadError } = await db
    .from("concept_mastery")
    .select("score, attempts_count, is_mastered")
    .eq("student_id", studentId);
  if (masteryReadError) throw new Error(`concept_mastery read: ${masteryReadError.message}`);

  // Same thresholds as lib/learning/mastery.ts (D5).
  const bands = (mastery ?? []).reduce<Record<string, number>>((acc, m) => {
    const band = m.is_mastered
      ? "mastered"
      : Number(m.score) >= 0.5
        ? "developing"
        : "needs_revision";
    acc[band] = (acc[band] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`   streak: ${streak?.current} days (best ${streak?.longest})`);
  console.log(`   mastery: ${JSON.stringify(bands)}`);
  console.log(`   badges: ${(badges as string[] | null)?.length ?? 0}`);

  return { email: DEMO_EMAIL, password, reused: Boolean(env.DEMO_PASSWORD) };
}

const purgeOnly = process.argv.includes("--purge-only");

await purge();

if (!purgeOnly) {
  const demo = await seedDemoLearner();
  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`  demo account : ${demo.email}`);
  console.log(`  password     : ${demo.password}`);
  if (!demo.reused) {
    console.log("\n  Save it to .env.local as DEMO_PASSWORD to keep it stable");
    console.log("  across re-runs. Without it, every run mints a new one.");
  }
  console.log("─────────────────────────────────────────────────────────\n");
}
