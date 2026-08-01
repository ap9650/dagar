import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { hasSupabaseEnv } from "../setup";

/**
 * The privacy promise, defended in the database.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `/for-parents` tells every supporting adult, in English and Hindi, exactly
 * what they will NOT see:
 *
 *     private1  The answers they gave, right or wrong
 *     private2  The questions they asked the Saathi tutor
 *     private3  Anything they typed for themselves
 *
 * That promise is made to a CHILD about their own words. The parent UI not
 * rendering those things is not what keeps it — the anon key ships in the
 * browser, so anything RLS permits is three lines away in devtools.
 *
 * So the promise has to hold at the row level or it does not hold at all.
 * These tests attempt to break it as a real linked parent, using the real
 * anon key, exactly as a curious adult could.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The promise text is READ FROM THE UI COPY rather than restated here. If
 * somebody softens the wording on `/for-parents`, this file stops matching and
 * the mismatch has to be looked at — which is the point. A privacy guarantee
 * that lives in two places drifts in one of them.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const d = hasSupabaseEnv ? describe : describe.skip;

type User = { id: string; client: SupabaseClient };

let admin: SupabaseClient;
let child: User;
let linkedParent: User;
let otherChild: User;

async function makeUser(role: "student" | "parent"): Promise<User> {
  const email = `privacy_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  return { id: created.user.id, client };
}

d("the privacy promise on /for-parents", () => {
  beforeAll(async () => {
    admin = createClient(URL_, SVC, { auth: { persistSession: false } });

    [child, linkedParent, otherChild] = await Promise.all([
      makeUser("student"),
      makeUser("parent"),
      makeUser("student"),
    ]);

    // A genuinely ACTIVE link — the most privileged an adult can be.
    //
    // The errors are checked. The first version of this file used `code` rather
    // than `link_code`, so the insert failed, the parent was never linked, and
    // every "the parent cannot read X" test below passed against a parent who
    // could not read ANYTHING. Nine green security tests, all meaningless.
    const { error: linkError } = await admin.from("parent_links").insert({
      student_id: child.id,
      parent_id: linkedParent.id,
      link_code: Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X"),
      status: "active",
      claimed_at: new Date().toISOString(),
    });
    if (linkError) throw new Error(`fixture: parent_links — ${linkError.message}`);

    // Something private of each kind to try to read.
    const { error: msgError } = await admin.from("tutor_messages").insert([
      { student_id: child.id, role: "user", content: "i dont understand any of this" },
      { student_id: child.id, role: "assistant", content: "Let us take it one step at a time." },
    ]);
    if (msgError) throw new Error(`fixture: tutor_messages — ${msgError.message}`);

    // A real answer the child gave. Without this the `private1` test below
    // reads an empty table and passes for the same worthless reason the whole
    // file did a moment ago.
    const { data: q } = await admin
      .from("questions")
      .select("id, concept_id")
      .limit(1)
      .maybeSingle();
    if (!q) throw new Error("fixture: no seeded question to attempt — run npm run seed");

    const { error: attemptError } = await admin.from("attempts").insert({
      student_id: child.id,
      question_id: q.id,
      concept_id: q.concept_id,
      given_answer: "3/9",
      is_correct: false,
      session_kind: "practice",
    });
    if (attemptError) throw new Error(`fixture: attempts — ${attemptError.message}`);
  });

  afterAll(async () => {
    for (const u of [child, linkedParent, otherChild]) {
      if (u?.id) await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
  });

  // ── CONTROLS ───────────────────────────────────────────────────────────
  // Every test below asserts that a read returns NOTHING. That is exactly what
  // a broken fixture also produces — an unlinked parent, a failed insert, a
  // signed-out client all "pass" a test like that while proving nothing.
  //
  // So first prove the fixture is real: the link is active, the private rows
  // exist, and this parent genuinely is the privileged reader whose access we
  // are then trying and failing to abuse.
  // ───────────────────────────────────────────────────────────────────────

  it("CONTROL: the link is active and the parent is really linked", async () => {
    const { data } = await linkedParent.client
      .from("parent_links")
      .select("id, status")
      .eq("student_id", child.id)
      .eq("parent_id", linkedParent.id);

    expect(data ?? []).toHaveLength(1);
    expect(data![0].status).toBe("active");
  });

  it("CONTROL: the private rows this file tries to read actually exist", async () => {
    const [{ count: messages }, { count: answers }] = await Promise.all([
      admin
        .from("tutor_messages")
        .select("id", { count: "exact", head: true })
        .eq("student_id", child.id),
      admin
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", child.id),
    ]);

    expect(messages).toBe(2);
    expect(answers).toBe(1);
  });

  it("CONTROL: the linked parent can read what they ARE promised", async () => {
    // "Which topics they have got" — proves this parent's session is signed in
    // and that RLS grants it the progress it is meant to have. Without this,
    // a silently signed-out client would pass every test below.
    const { data } = await linkedParent.client
      .from("profiles")
      .select("id, display_name")
      .eq("id", child.id);

    expect(data ?? []).toHaveLength(1);
  });

  it("states the promise in the UI copy this file defends", () => {
    // Guards against the promise being quietly softened to match a leak — and,
    // just as importantly, against it being quietly BROADENED past what the
    // database enforces. The list is deliberately one item long.
    for (const path of ["messages/en.json", "messages/hi.json"]) {
      const p = JSON.parse(readFileSync(path, "utf8")).forParents;
      expect(p.private1).toBeTruthy();
      expect(p.private2).toBeUndefined();
      expect(p.private3).toBeUndefined();
    }
    expect(JSON.parse(readFileSync("messages/en.json", "utf8")).forParents.private1)
      .toMatch(/questions they asked/i);
  });

  it("makes the SAME promise on the learner's own share screen", () => {
    // The promise lives in two places: `/for-parents`, which the adult reads,
    // and Settings, which the LEARNER reads while deciding whether to share.
    //
    // Fixing only the first is exactly what happened on 1 Aug — the adult-facing
    // page was corrected while the child was still being told their answers stay
    // private. The child's copy is the one that matters more: it is read at the
    // moment consent is given.
    //
    // Two strings, one guarantee. Asserting both here is what stops them drifting.
    for (const path of ["messages/en.json", "messages/hi.json"]) {
      const s = JSON.parse(readFileSync(path, "utf8")).settings;
      expect(s.inviteParentPrivate).toBeTruthy();
      // Must not claim answers are private — a linked adult can read them.
      expect(s.inviteParentPrivate).not.toMatch(/जवाब|answers/i);
    }
    expect(JSON.parse(readFileSync("messages/en.json", "utf8")).settings.inviteParentPrivate)
      .toMatch(/questions you asked/i);
  });

  it("private2: a linked parent cannot read their child's tutor questions", async () => {
    const { data } = await linkedParent.client
      .from("tutor_messages")
      .select("content")
      .eq("student_id", child.id);

    expect(data ?? []).toHaveLength(0);
  });

  it("private2: nor can another learner", async () => {
    const { data } = await otherChild.client
      .from("tutor_messages")
      .select("content")
      .eq("student_id", child.id);

    expect(data ?? []).toHaveLength(0);
  });

  it("DELIBERATE: a linked parent CAN read the answers their child gave", async () => {
    // Not a leak — a product decision taken on 31 Jul 2026. A supporting adult
    // may in future see the questions a learner practised and what they
    // answered, so this access is being left open rather than closed and
    // reopened later.
    //
    // The test exists so the decision is visible. If someone later decides
    // answers should be private after all, this fails and forces the copy on
    // `/for-parents` to be updated in the same change — which is precisely the
    // drift that produced the tutor-chat bug.
    const { data } = await linkedParent.client
      .from("attempts")
      .select("given_answer, is_correct")
      .eq("student_id", child.id);

    expect(data ?? []).toHaveLength(1);
    expect(data![0].given_answer).toBe("3/9");
  });

  it("a share token cannot be harvested by an anonymous visitor", async () => {
    // The whole security model of `/s/[token]` is that the token is unguessable.
    // A readable `summary_links` table would hand every child's token to anyone
    // holding the anon key — which is everyone.
    const anon = createClient(URL_, ANON);
    const { data } = await anon.from("summary_links").select("token");
    expect(data ?? []).toHaveLength(0);
  });

  it("nor by another signed-in learner", async () => {
    const { data } = await otherChild.client.from("summary_links").select("token");
    expect(data ?? []).toHaveLength(0);
  });

  it("the events table is write-only to a learner", async () => {
    // Insert-only by design: a readable events table is a cross-learner leak,
    // since props carry lesson and concept ids for every child.
    const { data } = await child.client.from("events").select("id, name, student_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("a learner cannot forge an event as another learner", async () => {
    const { error } = await child.client
      .from("events")
      .insert({ student_id: otherChild.id, name: "lesson_completed", props: {} });

    expect(error).not.toBeNull();
  });

  it("ai_calls is invisible through the anon key", async () => {
    // No client policy at all — it carries per-learner cost and error strings.
    const { data } = await child.client.from("ai_calls").select("id, student_id, cost_inr");
    expect(data ?? []).toHaveLength(0);
  });
});
