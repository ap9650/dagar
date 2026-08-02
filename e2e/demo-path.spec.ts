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
  const complete = page.getByRole("button", { name: /got it — continue/i });
  for (let step = 0; step < 15 && !(await complete.count()); step++) {
    await page.getByRole("button", { name: /^continue$/i }).first().click();
    await page.waitForTimeout(150);
  }
  await expect(complete).toBeVisible({ timeout: 10_000 });

  /*
    TWO buttons carry "Got it — continue": the step player's last-step button,
    and the completion button revealed beneath it. That is why this waits on the
    REQUEST rather than counting clicks.

    It has to. Until 2 Aug this was a single `complete.click()`, which only ever
    ended the steps — the loop above exits the moment the step player's own last
    button appears, since it shares the label. So `/complete` was never posted,
    and the demo path had never once covered lesson completion, the streak, or
    milestone awarding. Everything downstream still passed, which is exactly why
    it went unnoticed.
  */
  const completed = page.waitForResponse(
    (r) => r.url().includes("/complete") && r.request().method() === "POST",
    { timeout: 30_000 },
  );

  await complete.first().click();
  await page.waitForTimeout(400);
  // Still there ⇒ that click ended the steps and this one is the completion.
  // Gone ⇒ it was a prose lesson and the first click already completed it.
  if (await complete.count()) await complete.first().click();

  expect((await completed).ok()).toBeTruthy();

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
  await expect(page.getByText(/fraction/i).first()).toBeVisible();

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
