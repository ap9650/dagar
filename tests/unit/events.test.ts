import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_EVENTS,
  EVENT_NAMES,
  type EventName,
} from "@/lib/analytics/track";

/**
 * The canonical event list, checked against the code that emits it.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `EventName` is a union type, so passing an off-list name is already a compile
 * error. The failure this suite catches is the OPPOSITE one, and it has
 * happened here for real: `dashboard_viewed` sat in the metric definition for
 * weeks with nothing emitting it, so Recommendation Acceptance was uncomputable
 * and nobody found out until someone went looking for the number.
 *
 * A name on the list that nothing emits does not error. It reads ZERO, forever,
 * and zero is a plausible-looking answer. That is the bug worth a test.
 * ────────────────────────────────────────────────────────────────────────────
 */

const ROOT = join(__dirname, "..", "..");
const SOURCE_DIRS = ["app", "lib", "components"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const SOURCES = SOURCE_DIRS.flatMap((dir) => walk(join(ROOT, dir))).map((path) => ({
  path: path.slice(ROOT.length + 1),
  text: readFileSync(path, "utf8"),
}));

/** The file that defines the list is not evidence that anything emits from it. */
const EMITTERS = SOURCES.filter((file) => file.path !== "lib/analytics/track.ts");

/** Every place a name could legitimately appear as a live emit. */
function isEmitted(name: EventName): boolean {
  const quoted = new RegExp(`["'\`]${name}["'\`]`);
  return EMITTERS.some((file) => quoted.test(file.text));
}

describe("the canonical event list", () => {
  it("guards the guard — the source scan actually found files", () => {
    // Without this, a broken walk() makes every assertion below vacuously true
    // and the suite goes green while measuring nothing.
    expect(EMITTERS.length).toBeGreaterThan(100);
    expect(EMITTERS.some((f) => f.path === "app/api/lessons/[id]/complete/route.ts")).toBe(true);
  });

  it("has no duplicates", () => {
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
  });

  it.each(EVENT_NAMES)("%s is emitted by something", (name) => {
    expect(isEmitted(name)).toBe(true);
  });
});

describe("docs/ANALYTICS.md stays in step with the code", () => {
  const doc = readFileSync(join(ROOT, "docs/ANALYTICS.md"), "utf8");

  it.each(EVENT_NAMES)("%s appears in the catalogue", (name) => {
    // ANALYTICS.md is the stated single reference for both the event layer and
    // the dashboard. A reference that silently omits an event is how a number
    // gets built on a definition nobody wrote down — so the omission is a test
    // failure, not a documentation debt.
    expect(doc).toContain(`\`${name}\``);
  });

  it("names every table the dashboard reads", () => {
    for (const table of [
      "attempts",
      "concept_mastery",
      "streaks",
      "exit_reasons",
      "product_feedback",
      "ai_calls",
      "summary_links",
    ]) {
      expect(doc).toContain(table);
    }
  });
});

describe("anonymous events", () => {
  it("are all on the canonical list", () => {
    for (const name of ANONYMOUS_EVENTS) {
      expect(EVENT_NAMES).toContain(name);
    }
  });

  it("are emitted only through trackAnonymous, never through track()", () => {
    // The whole privacy argument for these rests on `student_id` being null.
    // Routing one through `track()` would silently attach a learner to it.
    for (const name of ANONYMOUS_EVENTS) {
      for (const file of EMITTERS) {
        expect(file.text).not.toMatch(new RegExp(`[^A-Za-z]track\\(\\s*["'\`]${name}`));
      }
    }
  });

  it("fire from the two pre-account screens and nowhere else", () => {
    const callers = EMITTERS.filter((file) => /trackAnonymous\(/.test(file.text)).map((f) => f.path);
    expect(callers.sort()).toEqual(["app/login/page.tsx", "app/welcome/page.tsx"]);
  });
});

describe("the /api/events allowlist", () => {
  const route = readFileSync(join(ROOT, "app/api/events/route.ts"), "utf8");
  const listed = [...route.matchAll(/"([a-z_]+)",?\s*(?:\/\/|\n)/g)]
    .map((match) => match[1])
    .filter((name) => (EVENT_NAMES as readonly string[]).includes(name));

  it("is a subset of the canonical list", () => {
    // The route takes its name from a request BODY, where the type system
    // cannot help. This is the only place an off-list string could get through.
    expect(listed.length).toBeGreaterThan(0);
    for (const name of listed) {
      expect(EVENT_NAMES).toContain(name);
    }
  });

  it("never accepts an event a learner could profit from faking", () => {
    // Completions, streaks and milestones are emitted by the handler that
    // performed the write. If one of these ever appears in CLIENT_EVENTS, the
    // retention numbers become editable from devtools.
    for (const forbidden of [
      "lesson_completed",
      "chapter_completed",
      "streak_extended",
      "milestone_earned",
      "quiz_submitted",
      "learner_registered",
    ]) {
      expect(listed).not.toContain(forbidden);
    }
  });

  it("never accepts an anonymous event", () => {
    // `/api/events` requires a session, so an anonymous name arriving here
    // would be written WITH a student_id — the exact opposite of the point.
    for (const name of ANONYMOUS_EVENTS) {
      expect(listed).not.toContain(name);
    }
  });
});

describe("props carry no PII", () => {
  const FORBIDDEN = [
    "display_name",
    "email",
    "learner_note",
    "link_code",
    "token",
    "message",
    "question:",
  ];

  it("still catches a real leak after literals are stripped", () => {
    // Guarding the guard. The strip above is what makes this check quiet; a
    // strip that swallowed everything would make it useless AND silent.
    const leak = 'await track("parent_invite_created", { code: created.link_code });';
    const stripped = leak.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
    expect(stripped).toContain("link_code");

    const safe = 'await track("parent_invite_created", { kind: "link_code" });';
    expect(safe.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""')).not.toContain("link_code");
  });

  it.each(EMITTERS.filter((file) => /\btrack(ForStudent|Anonymous)?\(/.test(file.text)))(
    "$path passes nothing identifying",
    (file) => {
      // `scrub()` already drops the known keys at runtime, but a secret handed
      // to an events table is a secret in a table we aggregate and read, and
      // the right time to catch that is before it is written.
      const calls = file.text.match(/\btrack(?:ForStudent|Anonymous)?\([\s\S]{0,400}?\);/g) ?? [];
      for (const call of calls) {
        // String LITERALS are stripped first. A hardcoded string cannot leak a
        // learner's anything — `{ kind: "link_code" }` is a label describing
        // which kind of invite was made, not a code. What matters is an
        // EXPRESSION reaching a prop: `created.link_code` survives this strip
        // and trips the check, which is exactly the distinction we want.
        const expressions = call.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
        for (const key of FORBIDDEN) {
          expect(expressions.includes(key), `${file.path} passes ${key}`).toBe(false);
        }
      }
    },
  );
});
