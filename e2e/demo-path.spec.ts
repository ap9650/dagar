import { test, expect } from "@playwright/test";

/**
 * The demo path — the single E2E test that matters (saathi-test skill).
 *
 * "If that test is green, your demo works."
 *
 * This file was a Day-0 placeholder until 1 Aug: three `test.fixme` stubs
 * written before the screens existed, and never filled in. So the journey being
 * demonstrated on Sunday had never once been walked end to end by anything but
 * a human. That is the gap this closes.
 *
 * ── what it deliberately does NOT do ────────────────────────────────────────
 * It never asserts a CORRECT answer. It cannot: answer keys are unreachable from
 * the browser by design (D3), which is the single most important security
 * property in the product. A test that knew the right answer would either be
 * hardcoding a fixture that silently rots when the seed changes, or proving the
 * answer key had leaked. So practice is exercised through the WRONG path, which
 * is the one that matters pedagogically anyway — a learner meets it far more
 * often, and it is where the amber-not-red rule lives.
 *
 * It also does not call the tutor. That is a paid, streaming, non-deterministic
 * endpoint; it is covered by `npm run eval`, which is the right tool for judging
 * model output. Here we assert only that the door to it is on the screen.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Unique per run, so a re-run never collides with a previous learner. */
function freshLearner() {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  return { email: `e2e_${stamp}@example.com`, password: "demo-password-12345" };
}

test("the app is up", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
});

test("the language picker is the first screen a new learner sees", async ({ page }) => {
  await page.goto("/welcome");

  // `radio`, not `button`: the options are styled labels over a visually-hidden
  // radio input. That is the accessible pattern — it keeps arrow-key navigation
  // and the native selected state that a div with an onClick throws away — and
  // asserting the ROLE here is what stops someone "simplifying" it into divs.
  //
  // Each option is written in its OWN script (D16). A learner who cannot read
  // English must still recognise their language — so this asserts the Devanagari
  // literally, not a transliteration.
  await expect(page.getByRole("radio", { name: "English" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "हिंदी" })).toBeVisible();
});

test("demo path: sign up → dashboard → lesson → practice → progress", async ({ page }) => {
  const learner = freshLearner();

  // ── sign up ───────────────────────────────────────────────────────────────
  await page.goto("/login");

  // The form opens in login mode; this toggle switches it to sign-up. At this
  // moment "Create an account" is unambiguous — it is the toggle. After the
  // switch the same name belongs to the submit button, which is what we want next.
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(learner.email);
  await page.getByLabel("Password").fill(learner.password);
  await page.getByRole("button", { name: "Create an account" }).click();

  // ── grade ─────────────────────────────────────────────────────────────────
  await expect(page.getByRole("heading", { name: /which class are you in/i })).toBeVisible({
    timeout: 15_000,
  });
  // Click the LABEL, not the input. The input is visually hidden behind it, so
  // that is both what Playwright can reach and what a learner's thumb actually
  // hits — the 64px card is the target, and the radio is an implementation
  // detail underneath it.
  await page.getByText("Class 6", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Class 6" })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  // ── dashboard ─────────────────────────────────────────────────────────────
  await page.waitForURL(/\/learn$/, { timeout: 15_000 });

  // The daily goal is the D17 return mechanic and the first thing on the screen.
  await expect(page.getByText(/today's goal/i)).toBeVisible();

  // One obvious next action, never a menu. A brand-new learner gets "Start here".
  const nextAction = page.getByRole("link", { name: /start here|continue/i }).first();
  await expect(nextAction).toBeVisible();
  await nextAction.click();

  // ── the lesson ────────────────────────────────────────────────────────────
  await page.waitForURL(/\/learn\/[^/]+\/[^/]+/, { timeout: 15_000 });

  // The tutor door is present on the lesson. We do not open it — see the header.
  // The tutor lost the app's name in the Dagar rename: "Ask Saathi" worked
  // because saathi is a person-word, and "ask the trail" does not. Naming the
  // tutor is the mascot's job.
  await expect(page.getByRole("button", { name: /ask a question/i })).toBeVisible();

  // ── walk the lesson ───────────────────────────────────────────────────────
  // Since D18 a lesson may be a sequence of steps rather than one scroll. This
  // walks whichever shape it is: a stepped lesson taps Continue to the end, a
  // prose one finds the complete button straight away.
  //
  // It also gives the step player its only end-to-end coverage — the loop is
  // bounded so a player that never advances fails here instead of hanging.
  const complete = page.getByRole("button", { name: /^got it$/i });
  for (let step = 0; step < 15 && !(await complete.count()); step++) {
    await page.getByRole("button", { name: /^continue$/i }).first().click();
    await page.waitForTimeout(150);
  }
  await expect(complete).toBeVisible({ timeout: 10_000 });

  /*
    ONE button finishes a lesson, and this asserts that.

    There used to be two, both labelled "Got it — continue": the step player's
    last-step button, and a completion button on a blank screen behind it. The
    test compensated by clicking twice and checking whether the label was still
    there — which passed either way and therefore proved nothing about how many
    screens a learner walks through.

    So the click count is the assertion now. If a second confirmation screen ever
    comes back, `complete` is still on screen after this and the check below
    fails. Waiting on the REQUEST rather than the label is what caught the
    original defect: until 2 Aug a single click only ended the steps, `/complete`
    was never posted, and the demo path had never once covered completion, the
    streak or milestone awarding. Everything downstream still passed.
  */
  const completed = page.waitForResponse(
    (r) => r.url().includes("/complete") && r.request().method() === "POST",
    { timeout: 30_000 },
  );

  await complete.first().click();
  expect((await completed).ok()).toBeTruthy();

  // One tap, not two: the finishing button is replaced by what comes next.
  await expect(complete).toHaveCount(0);

  // A first lesson always earns `first_lesson` (D7b), so the celebration is not
  // optional here — this is the one moment in the journey it is guaranteed.
  await expect(page.getByRole("status").filter({ hasText: /new badge/i })).toBeVisible({
    timeout: 10_000,
  });

  // ── practice, via the wrong answer ────────────────────────────────────────
  await page.goto("/progress");
  await page.getByRole("link", { name: /fraction/i }).first().click();
  await page.waitForURL(/\/practice\//, { timeout: 15_000 });

  await expect(page.getByText(/question 1 of/i)).toBeVisible();

  // Practice serves BOTH free-text and multiple-choice questions, and which one
  // comes first depends on the seed and on adaptivity. So the test handles
  // either rather than assuming — the first version assumed a textbox and broke
  // on an MCQ about a roti.
  const answerBox = page.getByRole("textbox", { name: /your answer/i });

  if (await answerBox.count()) {
    // Free text: nonsense, so it is wrong whatever the question is.
    await answerBox.fill("-999999");
  } else {
    // MCQ. We CANNOT force a wrong answer here: that would require knowing the
    // key, and the key never reaches the browser (D3). Picking a choice at
    // random would make this test pass or fail by luck.
    await page.locator("label").filter({ has: page.getByRole("radio") }).first().click();
  }

  await page.getByRole("button", { name: /check answer/i }).click();

  // THE INVARIANT THIS TEST PROTECTS, and it holds for either outcome:
  // after checking an answer there is ALWAYS a way forward on screen — a hint,
  // a retry, or the next question. Never a dead end.
  //
  // The amber-not-red rule for the wrong state specifically is asserted where it
  // can be done deterministically, not here where the outcome depends on a
  // choice we are not allowed to predict.
  await expect(
    page.getByRole("button", { name: /see a hint|try again|next question/i }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // ── progress ──────────────────────────────────────────────────────────────
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: /your progress/i })).toBeVisible();
  await expect(page.getByText(/badges/i).first()).toBeVisible();
});

/**
 * A learner can change their class, and the curriculum follows.
 *
 * Grade was read-only in Settings for a long time — the same defect the language
 * picker exists to prevent. Grade decides which chapters exist for you, so a
 * mis-tap at onboarding meant never reaching your own curriculum, with the app
 * simply looking as though it had the wrong content in it.
 *
 * The assertion that matters is the SECOND one: not that the setting saved, but
 * that the dashboard changed. A control that writes a row and leaves the learner
 * looking at Class 6 is the same bug wearing a success state.
 */
test("a learner can change class, and the chapters follow", async ({ page }) => {
  const learner = freshLearner();

  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(learner.email);
  await page.getByLabel("Password").fill(learner.password);
  await page.getByRole("button", { name: "Create an account" }).click();

  await page.getByText("Class 6", { exact: true }).click({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/learn$/, { timeout: 20_000 });
  // Data Handling, not Fractions. The dashboard shows the CURRENT chapter's
  // journey rather than every chapter, and Class 6 now opens on Ganita Prakash
  // Ch 4 because Fractions is Ch 7 — a learner meets them in the order their own
  // book has them. This assertion moved when the chapter landed on 3 Aug, which
  // is the point of asserting a real chapter name rather than "some text".
  await expect(page.getByText(/data handling/i).first()).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: "Class 6" })).toBeChecked();

  /*
    Wait for the WRITE, not just the tick.

    The control is optimistic: the radio flips the moment it is clicked, and the
    PATCH goes out behind it. So `toBeChecked()` passed instantly whether or not
    anything had been saved, and the `reload()` below raced the request — this
    test failed about one run in two, which is the worst kind of red because it
    looks like flakiness in the app rather than a missing await in the test.

    The optimistic UI is correct and stays. It is the assertion that has to be
    honest about what it has proved.
  */
  const [saved] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/profile") && r.request().method() === "PATCH",
      { timeout: 15_000 },
    ),
    page.getByText("Class 7", { exact: true }).click(),
  ]);
  expect(saved.ok()).toBeTruthy();
  await expect(page.getByRole("radio", { name: "Class 7" })).toBeChecked();

  // Survives a reload, so it reached the database and not just React state.
  await page.reload();
  await expect(page.getByRole("radio", { name: "Class 7" })).toBeChecked();

  // And the curriculum actually moved.
  await page.goto("/learn");
  await expect(page.getByText(/integer/i).first()).toBeVisible({ timeout: 15_000 });
});

/**
 * The launch path, for someone who is not signed in.
 *
 * The PWA's `start_url` is `/learn`, not `/` — `/` renders nothing and existed
 * only to redirect, which cost a blank screen and a whole round trip on every
 * cold launch. That made `proxy.ts` responsible for a rule it did not have
 * before: **a learner who has never chosen a language must meet the picker,
 * not an English login form** (D16).
 *
 * It is a redirect rule with no UI of its own, which is exactly the kind of
 * thing that regresses silently. Both branches are asserted.
 */
test("a launch with no session goes to the language picker, never past it", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Nothing at all: no session, no language ever chosen. A second child on a
  // shared phone, or a cleared browser.
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("radio", { name: "हिंदी" })).toBeVisible();

  await context.close();
});

/**
 * A corrupt session cookie signs you out. It does not take the app down.
 *
 * `proxy.ts` decides "signed in?" with `getClaims()`, which verifies the JWT
 * signature locally instead of paying a Mumbai→Tokyo round trip on every single
 * request. The behaviour that had to survive that swap is the UNHAPPY one:
 * `getUser()` answers a garbage cookie with `{ user: null }`, and if getClaims
 * were to THROW on the same input instead, the proxy would 500 — on every route
 * it matches, for anyone holding a stale or truncated cookie. That is not a
 * degraded session, it is a locked front door, and no other test would catch it
 * because every other test carries either a good cookie or none at all.
 *
 * A truncated cookie is the realistic shape of this: Supabase chunks large
 * session cookies across `.0`, `.1`… and a browser that drops one leaves
 * exactly this behind.
 */
test("a corrupt session cookie redirects, it does not error", async ({ browser }) => {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];

  const context = await browser.newContext();
  await context.addCookies([
    { name: "saathi_locale", value: "en", url: "http://localhost:3000" },
    // Not a JWT at all. Signature verification cannot succeed on this.
    { name: `sb-${ref}-auth-token`, value: "base64-not-a-real-token", url: "http://localhost:3000" },
  ]);
  const page = await context.newPage();

  const response = await page.goto("/learn");

  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login/);

  await context.close();
});

test("a signed-out learner who already picked a language goes to sign-in", async ({
  browser,
}) => {
  const context = await browser.newContext();
  // Kept as `saathi_locale` after the rename on purpose — see i18n/config.ts.
  await context.addCookies([
    { name: "saathi_locale", value: "en", url: "http://localhost:3000" },
  ]);
  const page = await context.newPage();

  await page.goto("/learn");
  // …and back to where they were headed once they are in.
  await expect(page).toHaveURL(/\/login\?next=%2Flearn$/);

  await context.close();
});
