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
  await expect(page.getByRole("button", { name: /ask saathi/i })).toBeVisible();

  await page.getByRole("button", { name: /got it — continue/i }).click();

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
