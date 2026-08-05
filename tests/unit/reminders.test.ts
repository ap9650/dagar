import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import hiMessages from "@/messages/hi.json";

/**
 * The daily reminder (D17b).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE COPY IS THE RISK, NOT THE CODE.
 *
 * A notification lands on whoever is holding the phone, which on a shared
 * family handset is often a parent. "Ready for today's lesson?" is safe to read
 * over a shoulder. "You haven't studied today" is a report card delivered to
 * the person whose opinion the learner cares about most.
 *
 * So the guard with the most value here is a copy test, not a logic one. It is
 * crude on purpose: a banned substring cannot be argued with the way a code
 * review can.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ROOT = join(__dirname, "..", "..");

const ALL_REMINDER_COPY = [
  ...Object.values(enMessages.push as Record<string, string>),
  ...Object.values(hiMessages.push as Record<string, string>),
];

describe("reminder copy", () => {
  it("exists in both languages, for every key", () => {
    // A missing Hindi line falls back to English on a screen where every other
    // word is Hindi — worse than not sending at all.
    expect(Object.keys(enMessages.push).sort()).toEqual(Object.keys(hiMessages.push).sort());
  });

  it("never counts down", () => {
    // D17b's line: timed to a ROUTINE, never to a deadline. A countdown is the
    // passive-aggressive-owl pattern, and it is wrong for a child and worse on
    // a shared phone.
    const banned = [
      "hours left",
      "hour left",
      "minutes left",
      "expires",
      "expiring",
      "before midnight",
      "last chance",
      "घंटे बाकी",
      "आख़िरी मौका",
      "आखिरी मौका",
      "आधी रात",
    ];
    for (const line of ALL_REMINDER_COPY) {
      for (const phrase of banned) {
        expect(line.toLowerCase(), `"${line}" contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it("never threatens the streak", () => {
    // "One more day and you reach a 7-day streak" is a fact stated as an
    // opportunity. "Your streak is at risk" is the same fact as a threat, and
    // the difference is the whole of D17b.
    const banned = ["at risk", "will break", "you will lose", "don't lose", "dies", "टूट जाएगी", "खो दोगे"];
    for (const line of ALL_REMINDER_COPY) {
      for (const phrase of banned) {
        expect(line.toLowerCase(), `"${line}" contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it("never blames the learner", () => {
    const banned = ["you haven't", "you have not", "you didn't", "you did not", "forgot", "missed", "भूल गए"];
    for (const line of ALL_REMINDER_COPY) {
      for (const phrase of banned) {
        expect(line.toLowerCase(), `"${line}" contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});

describe("the schedule", () => {
  const vercelJson = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
    crons: { path: string; schedule: string }[];
  };

  const reminders = vercelJson.crons.filter((cron) => cron.path.includes("/reminders/"));

  it("has exactly two reminder slots", () => {
    expect(reminders.map((c) => c.path).sort()).toEqual([
      "/api/cron/reminders/afternoon",
      "/api/cron/reminders/evening",
    ]);
  });

  it("runs each one ONCE a day", () => {
    // Vercel's Hobby plan rejects any expression that would fire more than once
    // a day AT DEPLOY TIME — so a `*/30` here does not degrade, it breaks the
    // deployment. The limit is per job, which is why two jobs are fine.
    for (const cron of reminders) {
      const [minute, hour] = cron.schedule.split(" ");
      expect(minute, `${cron.path} minute must be fixed`).toMatch(/^\d+$/);
      expect(hour, `${cron.path} hour must be fixed`).toMatch(/^\d+$/);
    }
  });

  it("fires at after-school and after-dinner IST, not at a day boundary", () => {
    // Schedules are UTC; IST is UTC+5:30.
    const istHour = (schedule: string) => {
      const [minute, hour] = schedule.split(" ").map(Number);
      return (hour * 60 + minute + 330) / 60;
    };

    const afternoon = reminders.find((c) => c.path.endsWith("afternoon"))!;
    const evening = reminders.find((c) => c.path.endsWith("evening"))!;

    expect(istHour(afternoon.schedule)).toBe(16); // 4pm — after school
    expect(istHour(evening.schedule)).toBe(20); // 8pm — after dinner, before bed

    // Four clear hours before the IST day ends, so the evening slot is a window
    // rather than a countdown — even with Vercel Hobby's ±59 minute drift.
    expect(istHour(evening.schedule)).toBeLessThanOrEqual(21);
  });

  it("keeps every cron within the once-a-day Hobby limit", () => {
    for (const cron of vercelJson.crons) {
      expect(cron.schedule.split(" ")[0], `${cron.path}`).not.toContain("*");
      expect(cron.schedule.split(" ")[1], `${cron.path}`).not.toContain("*");
    }
  });
});

describe("the send route", () => {
  const source = readFileSync(
    join(ROOT, "app/api/cron/reminders/[slot]/route.ts"),
    "utf8",
  );

  it("is guarded by CRON_SECRET", () => {
    // Without it this is a public button that pushes to children's devices.
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("Bearer ${secret}");
  });

  it("skips learners who have already met the goal", () => {
    // What makes two reminders a day safe is not the number — it is that
    // neither fires once the day's work is done. An app that reminds you to do
    // something you have done is an app you stop trusting.
    //
    // The rule moved into `reminderPlan.ts` when the dry run at
    // `/admin/notifications` needed it: a dry run that reimplemented this would
    // prove the reimplementation, not the job. So the assertion follows it —
    // and the route must now send from the plan rather than deciding again.
    const plan = readFileSync(join(ROOT, "lib/notify/reminderPlan.ts"), "utf8");
    expect(plan).toContain("dayQualified");
    expect(plan).toContain("send: !met");

    // The route decides nothing on its own: no second copy of the rule.
    expect(source).toContain("planReminders(admin, slot)");
    expect(source).toContain("if (!item.send)");
    expect(source).not.toContain("dayQualified");
  });

  it("deletes endpoints the push service says are gone", () => {
    expect(source).toContain("result.gone");
    expect(source).toContain('.from("push_subscriptions").delete()');
  });
});

describe("when the nudge is allowed to appear", () => {
  const actions = readFileSync(join(ROOT, "components/learn/LessonActions.tsx"), "utf8");
  const prompt = readFileSync(join(ROOT, "components/learn/ReminderPrompt.tsx"), "utf8");
  const practice = readFileSync(join(ROOT, "components/learn/PracticeSession.tsx"), "utf8");
  const hook = readFileSync(join(ROOT, "components/learn/useLessonCompletion.ts"), "utf8");

  /*
    A permission ask before any value has been delivered is how an app spends
    its ONE refusal — a browser remembers "denied" for good and Dagar cannot ask
    again from inside itself. So the whole design of this card is *when* it
    shows, and that is worth a guard.

    Reported from a phone: the nudge greeted a learner on a lesson screen before
    they had finished anything. The cause was `complete` — a recorded FACT that
    is already true the instant a finished lesson is reopened — standing in for
    the MOMENT of finishing. Asking someone to enable notifications because they
    reopened a lesson to reread it is asking a favour in return for nothing, and
    it spends the refusal at the worst possible moment.
  */
  it("is offered only as today's goal closes, never on arrival", () => {
    expect(actions).toMatch(/\{\s*goalClosed\s*&&\s*<ReminderPrompt\s*\/>\s*\}/);
    // Neither weaker trigger may gate it. Matches the JSX specifically, so the
    // prose above — which names both deliberately — cannot satisfy these.
    expect(actions).not.toMatch(/\{\s*complete\s*&&\s*<ReminderPrompt\s*\/>\s*\}/);
    expect(actions).not.toMatch(/\{\s*justCompleted\s*&&\s*<ReminderPrompt\s*\/>\s*\}/);
  });

  it("takes the goal from the server, never from the client's own guess", () => {
    // `dayCounted` is "today BECAME a counted day", decided in the completion
    // route against the IST calendar (D7). A client that inferred it from its
    // own clock would ask twice on a day that crossed midnight in the wrong
    // timezone, and a permission ask has one chance.
    expect(hook).toMatch(/setGoalClosed\(body\.dayCounted === true\)/);
    expect(practice).toMatch(/if \(body\.dayCounted\) setGoalClosed\(true\)/);
  });

  it("is offered at the end of a practice set too, not only after a lesson", () => {
    // One lesson OR five practice questions closes the same goal (D7/D17). A
    // learner who only ever practises must still be asked — and must not be
    // asked beside a live question.
    expect(practice).toMatch(/\{\s*goalClosed\s*&&\s*<ReminderPrompt\s*\/>\s*\}/);
  });

  it("asks at most once per browser, and remembers a decline", () => {
    expect(prompt).toContain("PUSH_ASKED_KEY");
    expect(prompt).toMatch(/if \(asked/);
  });

  it("says nothing to a browser that has already granted or denied", () => {
    // Nothing useful to offer either way, and a card about a setting the
    // learner cannot change from here is nagging.
    expect(prompt).toMatch(/permissionState\(\) === "granted"/);
    expect(prompt).toMatch(/permissionState\(\) === "denied"/);
  });
});

describe("the service worker", () => {
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");

  it("handles push and notificationclick", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
  });

  it("collapses reminders instead of stacking them", () => {
    // Without a tag an evening nudge stacks under the afternoon one and a
    // learner wakes to a pile — the escalating-nag pattern D17 refuses,
    // assembled by accident.
    expect(sw).toContain('tag: "dagar-reminder"');
  });

  it("never makes a notification undismissable", () => {
    // `requireInteraction` would mean a child cannot swipe it away — a
    // notification that punishes them for not doing homework.
    //
    // Matches the PROPERTY, not the word: the source comments say "never
    // requireInteraction", and a substring check would fail on the comment
    // that exists to prevent the thing. Same trap as the events PII test.
    expect(sw).not.toMatch(/requireInteraction\s*:/);
  });

  it("drops a payload-less push rather than showing an empty one", () => {
    expect(sw).toContain("if (!event.data) return;");
  });
});
