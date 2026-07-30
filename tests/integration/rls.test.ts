import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv } from "../setup";

/**
 * RLS boundary tests.
 *
 * Every test here ATTEMPTS THE VIOLATION and asserts it fails. A test that only
 * proves the happy path proves nothing about a security boundary.
 *
 * These hit the real Supabase project and clean up after themselves.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const d = hasSupabaseEnv ? describe : describe.skip;

type Learner = { id: string; email: string; client: SupabaseClient };

let admin: SupabaseClient;
let alice: Learner;
let bob: Learner;
let parentOfAlice: Learner;
let strangerParent: Learner;
let chapterId: string;
let conceptId: string;
let questionId: string;

async function makeUser(role: "student" | "parent"): Promise<Learner> {
  const email = `rls_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "test-password-12345";

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("no user");

  await admin.from("profiles").insert({
    id: created.user.id,
    role,
    display_name: role,
    grade: role === "student" ? 6 : null,
  });

  const client = createClient(URL_, ANON);
  await client.auth.signInWithPassword({ email, password });
  return { id: created.user.id, email, client };
}

d("RLS boundaries", () => {
  beforeAll(async () => {
    admin = createClient(URL_, SVC, { auth: { persistSession: false } });

    [alice, bob, parentOfAlice, strangerParent] = await Promise.all([
      makeUser("student"),
      makeUser("student"),
      makeUser("parent"),
      makeUser("parent"),
    ]);

    // Curriculum + one question with a known answer key.
    const { data: ch } = await admin
      .from("chapters")
      .insert({ grade: 6, number: 999, title: "__rls__", slug: `__rls_ch_${Date.now()}` })
      .select()
      .single();
    chapterId = ch!.id;

    const { data: cn } = await admin
      .from("concepts")
      .insert({ chapter_id: chapterId, name: "__rls__", slug: `__rls_cn_${Date.now()}` })
      .select()
      .single();
    conceptId = cn!.id;

    const { data: q } = await admin
      .from("questions")
      .insert({
        concept_id: conceptId,
        chapter_id: chapterId,
        kind: "practice",
        difficulty: 1,
        stem_md: "1/2 + 1/4 = ?",
        answer_type: "fraction",
        answer_value: "3/4",
        solution_md: "the secret working",
        // The Hindi translation carries its OWN copy of the solution (D16 stores
        // every translation in `i18n`). This is the shape that leaked in 0012 —
        // the column list was clean and the answer travelled inside the jsonb.
        i18n: {
          hi: {
            stem_md: "1/2 + 1/4 = ?",
            solution_md: "the secret working, translated",
          },
        },
      })
      .select()
      .single();
    questionId = q!.id;

    // Alice has an attempt. Bob must never see it.
    await admin.from("attempts").insert({
      student_id: alice.id,
      question_id: questionId,
      concept_id: conceptId,
      given_answer: "3/4",
      is_correct: true,
      session_kind: "practice",
    });

    // parentOfAlice is linked and active; strangerParent is not linked at all.
    await admin.from("parent_links").insert({
      student_id: alice.id,
      parent_id: parentOfAlice.id,
      link_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: "active",
      claimed_at: new Date().toISOString(),
    });
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await admin.from("chapters").delete().eq("id", chapterId);
    for (const u of [alice, bob, parentOfAlice, strangerParent]) {
      if (u?.id) await admin.auth.admin.deleteUser(u.id);
    }
  }, 60_000);

  // ─── the answer key ────────────────────────────────────────────────────────

  it("a learner cannot read questions.answer_value", async () => {
    const { data } = await alice.client.from("questions").select("answer_value");
    expect(data ?? []).toHaveLength(0);
  });

  it("a learner reading the base table gets nothing, though the row exists", async () => {
    const { data: asLearner } = await alice.client.from("questions").select("*");
    expect(asLearner ?? []).toHaveLength(0);

    const { data: asAdmin } = await admin.from("questions").select("*").eq("id", questionId);
    expect(asAdmin ?? []).toHaveLength(1); // it is definitely there
  });

  it("questions_public serves the question WITHOUT the answer key", async () => {
    const { data } = await alice.client
      .from("questions_public")
      .select("*")
      .eq("id", questionId);

    expect(data ?? []).toHaveLength(1);
    const row = data![0] as Record<string, unknown>;
    expect(row).not.toHaveProperty("answer_value");
    expect(row).not.toHaveProperty("solution_md");
    expect(row.stem_md).toBe("1/2 + 1/4 = ?");
  });

  it("questions_public does not leak the solution INSIDE the i18n blob", async () => {
    // ── The regression test for migration 0012. ──
    //
    // The assertion above passed for weeks while the answer was shipping to every
    // learner, because `not.toHaveProperty("solution_md")` only inspects the top
    // level and the leak was one level down, inside a jsonb column that looked
    // like harmless translation data. It was found by reading a real response
    // body, which is why guided-practice.md §7 demands exactly that.
    //
    // So this searches the WHOLE serialised row for the solution text, rather
    // than naming the place it is expected not to be.
    const { data } = await alice.client
      .from("questions_public")
      .select("*")
      .eq("id", questionId);

    const serialised = JSON.stringify(data![0]);
    expect(serialised).not.toContain("the secret working");
    expect(serialised).not.toContain("solution_md");

    // …and the translated stem still comes through, because stripping the
    // solution must not cost a Hindi learner their question.
    const i18n = (data![0] as { i18n: Record<string, Record<string, string>> }).i18n;
    expect(i18n.hi.stem_md).toBe("1/2 + 1/4 = ?");
  });

  // ─── learner ↔ learner ─────────────────────────────────────────────────────

  it("student B cannot read student A's attempts", async () => {
    const { data } = await bob.client.from("attempts").select("*").eq("student_id", alice.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("student B cannot write a row belonging to student A", async () => {
    const { error } = await bob.client.from("attempts").insert({
      student_id: alice.id, // impersonation attempt
      question_id: questionId,
      concept_id: conceptId,
      given_answer: "3/4",
      is_correct: true,
      session_kind: "practice",
    });
    expect(error).not.toBeNull(); // RLS with-check must reject this

    const { count } = await admin
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("student_id", alice.id);
    expect(count).toBe(1); // still just the one we seeded
  });

  it("student B cannot read student A's profile", async () => {
    const { data } = await bob.client.from("profiles").select("*").eq("id", alice.id);
    expect(data ?? []).toHaveLength(0);
  });

  // ─── the chapter quiz (2.4) ────────────────────────────────────────────────

  it("student B cannot read or submit student A's quiz session", async () => {
    // The session id is the only thing standing between one learner and another
    // learner's quiz, and it travels in a URL. So it must not be enough on its own.
    const { data: aliceSession } = await admin
      .from("quiz_sessions")
      .insert({ student_id: alice.id, chapter_id: chapterId, question_ids: [questionId] })
      .select("id")
      .single();

    const { data: read } = await bob.client
      .from("quiz_sessions")
      .select("*")
      .eq("id", aliceSession!.id);
    expect(read ?? []).toHaveLength(0);

    // Scoring it for her is the more damaging move: it would close her quiz and
    // write a score she never earned.
    const { data: updated } = await bob.client
      .from("quiz_sessions")
      .update({ score: 8, total: 8, mastery_band: "mastered" })
      .eq("id", aliceSession!.id)
      .select("id");
    expect(updated ?? []).toHaveLength(0);

    const { data: after } = await admin
      .from("quiz_sessions")
      .select("score, mastery_band, submitted_at")
      .eq("id", aliceSession!.id)
      .single();
    expect(after!.score).toBeNull();
    expect(after!.mastery_band).toBeNull();
    expect(after!.submitted_at).toBeNull();
  });

  it("a learner cannot open a quiz session in someone else's name", async () => {
    const { error } = await bob.client.from("quiz_sessions").insert({
      student_id: alice.id, // impersonation attempt
      chapter_id: chapterId,
      question_ids: [questionId],
    });
    expect(error).not.toBeNull();
  });

  it("quiz questions are as answer-key-free as practice ones", async () => {
    // `kind` changes nothing about the boundary — `questions_public` is one view
    // over one table — but the quiz is the screen where a leaked key is worth the
    // most to a learner, so it is checked rather than assumed.
    const { data: quizQ } = await admin
      .from("questions")
      .insert({
        concept_id: conceptId,
        chapter_id: chapterId,
        kind: "quiz",
        difficulty: 2,
        stem_md: "__rls quiz stem__",
        answer_type: "integer",
        answer_value: "42",
        solution_md: "the quiz working",
        i18n: { hi: { stem_md: "__rls quiz stem hi__", solution_md: "the quiz working, translated" } },
      })
      .select("id")
      .single();

    const { data } = await alice.client
      .from("questions_public")
      .select("*")
      .eq("id", quizQ!.id);

    expect(data ?? []).toHaveLength(1);

    const serialised = JSON.stringify(data![0]);
    expect(serialised).not.toContain("the quiz working");
    expect(serialised).not.toContain("answer_value");
    expect(serialised).toContain("__rls quiz stem hi__"); // the Hindi stem survives

    // The answer VALUE is checked by walking the row rather than by searching
    // the serialised string: "42" is two hex characters and turns up inside a
    // uuid roughly half the time, which made the string search fail on a row
    // that was perfectly clean. A false alarm on a security test is not free —
    // it is how people learn to skip the security test.
    const values: unknown[] = [];
    const walk = (node: unknown) => {
      if (node === null || typeof node !== "object") return values.push(node);
      for (const child of Object.values(node as Record<string, unknown>)) walk(child);
    };
    walk(data![0]);
    expect(values).not.toContain("42");
  });

  // ─── parent boundary ───────────────────────────────────────────────────────

  it("a linked parent CAN read their child's attempts", async () => {
    const { data } = await parentOfAlice.client
      .from("attempts")
      .select("*")
      .eq("student_id", alice.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("an UNLINKED parent cannot read that child's attempts", async () => {
    const { data } = await strangerParent.client
      .from("attempts")
      .select("*")
      .eq("student_id", alice.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("a linked parent cannot WRITE learner data", async () => {
    const { error } = await parentOfAlice.client.from("attempts").insert({
      student_id: alice.id,
      question_id: questionId,
      concept_id: conceptId,
      given_answer: "9/9",
      is_correct: true,
      session_kind: "practice",
    });
    expect(error).not.toBeNull(); // there is no parent write policy anywhere
  });

  it("a linked parent cannot modify their child's profile", async () => {
    const { data } = await parentOfAlice.client
      .from("profiles")
      .update({ display_name: "hacked" })
      .eq("id", alice.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: check } = await admin.from("profiles").select("display_name").eq("id", alice.id).single();
    expect(check!.display_name).toBe("student");
  });

  // ─── anon ──────────────────────────────────────────────────────────────────

  it("an anonymous visitor cannot read any learner data", async () => {
    const anon = createClient(URL_, ANON);
    for (const table of ["profiles", "attempts", "lesson_progress", "tutor_messages"]) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }
  });
});
