import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv } from "../setup";
import { generateLinkCode } from "@/lib/parent/linkCode";

/**
 * Parent link claiming (D2) — the database half.
 *
 * The route handler's guards (role, expiry, rate limit) are exercised against
 * the running app. What is proved HERE is the part that has to hold even if a
 * handler is rewritten: that the claim is genuinely single-use, and that a
 * claimed link grants exactly the reads the parent policy allows and no others.
 *
 * The single-use property is a conditional UPDATE, not a read-then-write check,
 * and this file is where that distinction is actually tested — two claims land
 * concurrently and exactly one must win.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const d = hasSupabaseEnv ? describe : describe.skip;

let admin: SupabaseClient;
let learnerId: string;
let parentAId: string;
let parentBId: string;

async function makeUser(role: "student" | "parent"): Promise<string> {
  const email = `pl_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-password-12345",
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user");

  await admin.from("profiles").insert({
    id: data.user.id,
    role,
    display_name: role,
    grade: role === "student" ? 6 : null,
  });
  return data.user.id;
}

async function newPendingLink(): Promise<{ id: string; code: string }> {
  const code = generateLinkCode();
  const { data, error } = await admin
    .from("parent_links")
    .insert({ student_id: learnerId, link_code: code })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, code };
}

/** The claim, exactly as the route performs it. */
function claim(linkId: string, parentId: string) {
  return admin
    .from("parent_links")
    .update({
      parent_id: parentId,
      status: "active",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", linkId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
}

d("parent link claiming", () => {
  beforeAll(async () => {
    admin = createClient(URL_, SVC, { auth: { persistSession: false } });
    learnerId = await makeUser("student");
    parentAId = await makeUser("parent");
    parentBId = await makeUser("parent");
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    for (const id of [learnerId, parentAId, parentBId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  }, 60_000);

  it("a code can be claimed exactly once", async () => {
    const link = await newPendingLink();

    const { data: first } = await claim(link.id, parentAId);
    expect(first?.id).toBe(link.id);

    // Parent B has the same code — shared in a family WhatsApp group, say.
    const { data: second } = await claim(link.id, parentBId);
    expect(second).toBeNull();

    const { data: row } = await admin
      .from("parent_links")
      .select("parent_id, status")
      .eq("id", link.id)
      .single();
    expect(row!.parent_id).toBe(parentAId); // the first claimant keeps it
    expect(row!.status).toBe("active");
  }, 30_000);

  it("two simultaneous claims resolve to one winner", async () => {
    // The reason the claim is a conditional UPDATE rather than a read-then-write:
    // a read-then-write would let both of these see `pending` and both proceed.
    const link = await newPendingLink();

    const [a, b] = await Promise.all([
      claim(link.id, parentAId),
      claim(link.id, parentBId),
    ]);

    const winners = [a.data, b.data].filter(Boolean);
    expect(winners).toHaveLength(1);
  }, 30_000);

  it("link codes are unique across the whole table", async () => {
    // Two learners cannot end up sharing a code — the route retries on this
    // violation rather than showing anyone an error.
    const link = await newPendingLink();
    const { error } = await admin
      .from("parent_links")
      .insert({ student_id: learnerId, link_code: link.code });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");
  }, 30_000);

  it("a claimed link opens exactly one child's data, and nothing else", async () => {
    const link = await newPendingLink();
    await claim(link.id, parentAId);

    // A second, unrelated learner the parent has no link to.
    const strangerId = await makeUser("student");
    await admin.from("streaks").insert({ student_id: strangerId, current: 3, longest: 3 });
    await admin.from("streaks").insert({ student_id: learnerId, current: 5, longest: 5 });

    const parentClient = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: session } = await parentClient.auth.signInWithPassword({
      email: (await admin.auth.admin.getUserById(parentAId)).data.user!.email!,
      password: "test-password-12345",
    });
    expect(session.session).not.toBeNull();

    // Their own child: readable.
    const { data: mine } = await parentClient
      .from("streaks")
      .select("student_id, current")
      .eq("student_id", learnerId);
    expect(mine).toHaveLength(1);
    expect(mine![0].current).toBe(5);

    // Someone else's child: nothing, even asking by id.
    const { data: theirs } = await parentClient
      .from("streaks")
      .select("student_id, current")
      .eq("student_id", strangerId);
    expect(theirs ?? []).toHaveLength(0);

    // And no write, anywhere — D2 has no parent write policy on any table.
    const { error: writeError } = await parentClient
      .from("streaks")
      .update({ current: 999 })
      .eq("student_id", learnerId)
      .select("student_id");
    const { data: unchanged } = await admin
      .from("streaks")
      .select("current")
      .eq("student_id", learnerId)
      .single();
    expect(unchanged!.current).toBe(5);
    void writeError;

    await admin.auth.admin.deleteUser(strangerId);
  }, 60_000);

  it("a revoked link stops working immediately", async () => {
    // `status` is the switch a parent's access hangs on, and revocation has to
    // be a state change rather than a delete so the row survives for audit.
    //
    // A FRESH parent, not parentA or parentB. The simultaneous-claim test above
    // leaves an active link with whichever of those two won the race — so
    // reusing either would make this test pass or fail depending on a race, and
    // a security test that is right 50% of the time is worse than none.
    const revokedParentId = await makeUser("parent");
    const link = await newPendingLink();
    await claim(link.id, revokedParentId);

    const parentClient = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await parentClient.auth.signInWithPassword({
      email: (await admin.auth.admin.getUserById(revokedParentId)).data.user!.email!,
      password: "test-password-12345",
    });

    // While active: readable.
    const { data: before } = await parentClient
      .from("streaks")
      .select("student_id")
      .eq("student_id", learnerId);
    expect(before ?? []).toHaveLength(1);

    await admin.from("parent_links").update({ status: "revoked" }).eq("id", link.id);

    // Revoked: gone, on the same session, with no sign-out required.
    const { data: after } = await parentClient
      .from("streaks")
      .select("student_id")
      .eq("student_id", learnerId);
    expect(after ?? []).toHaveLength(0);

    await admin.auth.admin.deleteUser(revokedParentId);
  }, 60_000);
});
