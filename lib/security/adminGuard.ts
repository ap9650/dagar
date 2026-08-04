import "server-only";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * The admin boundary — the only door in Dagar that opens onto every learner at
 * once.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAIL CLOSED. This is the whole design, and it is the opposite of how a role
 * check usually goes wrong.
 *
 * Everywhere else in this product, a missing row means "not yet" and the app
 * carries on: a learner with no profile goes to onboarding, a parent with no
 * link reads nothing. Here, a missing configuration must mean **nobody gets
 * in** — including whoever deployed it. `/admin/metrics` aggregates the
 * activity of every child using Dagar, so the failure mode has to be a locked
 * door and never an open one.
 *
 * So: no `ADMIN_EMAILS`, empty `ADMIN_EMAILS`, a typo in `ADMIN_EMAILS` — all
 * of them lock everyone out. That is a loud, immediate, self-inflicted outage
 * of one private page, which is exactly the right price.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── WHY AN ENV VAR AND NOT A ROLE COLUMN ────────────────────────────────────
 * `profiles.role` is `student | parent` and nothing else. Adding `admin` there
 * would make the boundary a database write — so anything that could write one
 * profile row could grant itself the whole cohort. An env var cannot be
 * escalated into: reading every learner's data would require deploying a change
 * to the deployment itself.
 *
 * ── WHY 404 AND NOT 403 ─────────────────────────────────────────────────────
 * A 403 says "there is an admin dashboard here and you are not allowed in",
 * which is a fact worth having if you are looking for a way in. A 404 says
 * nothing. The page is not linked from anywhere in the app either, so for
 * everyone who is not on the list, `/admin/metrics` simply does not exist.
 */

/**
 * Split `ADMIN_EMAILS` into a normalised allowlist.
 *
 * Exported and pure so the parsing can be tested without a session. Every entry
 * is trimmed and lowercased; blanks are dropped, which is what makes a trailing
 * comma harmless rather than a wildcard.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Is this email on the allowlist?
 *
 * Exact match after normalising, and deliberately nothing cleverer. No
 * wildcards, no domain matching, no prefix rules — `@dagar.app` as an entry
 * matches the literal address `@dagar.app` and nothing else. A matcher with
 * features is a matcher with a way to be wrong, and the list has one name on it.
 */
export function isAdminEmail(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (allowlist.length === 0) return false; // fail closed
  if (!email) return false;
  const candidate = email.trim().toLowerCase();
  if (candidate.length === 0) return false;
  return allowlist.includes(candidate);
}

/**
 * The signed-in admin's email, or null.
 *
 * Reads identity from the server session — never from a header, a query
 * parameter or anything else the caller controls. `getCurrentUser` is
 * request-cached, so calling this in a layout and again in the page costs one
 * round trip, not two.
 */
export async function getAdminEmail(): Promise<string | null> {
  const allowlist = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (allowlist.length === 0) {
    // Loud on the server, silent to the visitor. Someone who deployed without
    // the variable needs to know why their own page vanished; a stranger
    // learns nothing either way.
    console.warn("[admin] ADMIN_EMAILS is unset or empty — /admin is closed to everyone.");
    return null;
  }

  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email, allowlist)) return null;

  return user!.email!.trim().toLowerCase();
}

/**
 * Guard a server component. Renders the 404 page for everyone else.
 *
 * `notFound()` throws, so control never returns to the caller on failure — this
 * cannot be misused by ignoring its result the way a boolean can.
 */
export async function requireAdmin(): Promise<string> {
  const email = await getAdminEmail();
  if (!email) notFound();
  return email;
}

/**
 * Guard a route handler. Same 404 reasoning, as a response rather than a throw.
 *
 * Shaped like `requireAuth` in `authGuard.ts` so the call sites read the same:
 * `const admin = await requireAdminRoute(); if (!admin.ok) return admin.response;`
 */
export async function requireAdminRoute(): Promise<
  { ok: true; email: string } | { ok: false; response: NextResponse }
> {
  const email = await getAdminEmail();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, email };
}
