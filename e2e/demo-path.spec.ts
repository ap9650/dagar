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

  /*
    One obvious next action, never a menu.

    Selected by the `from=rec` marker rather than by its label. Since the
    chapter list landed, the recommended chapter's card also reads "Start here"
    — so a name-based selector could match either, and `.first()` would have
    been relying on DOM order to tell a lesson link from a chapter link.

    The marker is also the thing Recommendation Acceptance is built on
    (`RECOMMENDATION_MARKER`), so asserting on it covers the metric's wiring at
    the same time: no marker, no numerator, and this test says so.
  */
  const nextAction = page.locator('a[href*="from=rec"]').first();
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
  const completionResponse = await completed;
  expect(completionResponse.ok()).toBeTruthy();

  /*
    THE FIRST LESSON OF THE DAY CLOSES THE DAILY GOAL.

    `dayCounted` is "today BECAME a counted day" — the server's answer, decided
    against the IST calendar (D7). It is what the daily celebration and the
    reminder offer both hang on (D17b-ii), and neither can be seen from here:
    headless Chrome reports notification permission as "denied", so the reminder
    card correctly renders nothing. Asserting the FACT it keys off is the part
    this test can honestly prove, and it is the part that silently breaks.
  */
  expect(await completionResponse.json()).toMatchObject({ dayCounted: true });

  // One tap, not two: the finishing button is replaced by what comes next.
  await expect(complete).toHaveCount(0);

  // A first lesson always earns `first_lesson` (D7b), so the celebration is not
  // optional here — this is the one moment in the journey it is guaranteed.
  await expect(page.getByRole("status").filter({ hasText: /new badge/i })).toBeVisible({
    timeout: 10_000,
  });

  /*
    ── A FINISHED LESSON CAN BE GONE BACK TO ────────────────────────────────
    Reported from a phone: finish a lesson and there is no way back to revise
    it. The cause was a link that said "back to the chapter" and went to the
    HOME screen — correct while the dashboard WAS the chapter view, wrong from
    the moment `/learn/[chapter]` existed. And because the recommendation moves
    on to the next lesson as soon as one is finished, the home screen offered no
    route back to the lesson just completed.

    Asserted as the learner's actual goal — reopen the thing I just did — rather
    than as "the href is correct", so it stays true however the navigation is
    later rearranged.
  */
  const finishedLesson = new URL(page.url()).pathname;

  await page.getByRole("link", { name: /back to the chapter/i }).click();
  await page.waitForURL(/\/learn\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The completed lesson is still on the path and still opens.
  await page.getByRole("link", { name: /lesson 1/i }).first().click();
  await page.waitForURL(/\/learn\/[^/]+\/[^/]+/, { timeout: 15_000 });

  const revisited = new URL(page.url());
  expect(revisited.pathname).toBe(finishedLesson);

  /*
    AND THE LESSON IS ACTUALLY THERE.

    This assertion is the one the first version of this block was missing, and
    the miss is instructive: arriving at the right URL was checked, having
    something to read when you got there was not. So the navigation fix went out
    green while the screen a learner reached still held a title, "Lesson
    complete" and nothing else — reported from a phone, with the screenshot.

    The player was hidden by `complete`, which is true the moment a finished
    lesson is REOPENED, rather than by finishing it here and now. Reopening a
    finished lesson must start it from the top like any other: nothing in Dagar
    is gated, and revision is the entire point of coming back.
  */
  await expect(page.getByText(/step 1 of/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /continue|got it/i })).toBeVisible();

  // And the moment-of-finishing surfaces do NOT reappear for a reread: the
  // sticky footer belongs to the end of the lesson, not to arriving at it.
  await expect(page.getByText(/^lesson complete$/i)).toBeHidden();

  /*
    PATHNAME, not the whole URL — and the difference matters.

    The first visit carried `?from=rec`, because the learner arrived from the
    next-action card. Coming back through the chapter path must NOT carry it: the
    marker is what makes the destination emit `recommendation_clicked`, so a
    revisit inheriting it would count every revision as accepting a
    recommendation and inflate the metric with rereading.
  */
  expect(revisited.searchParams.get("from")).toBeNull();

  /*
    ── EVERY CONCEPT ON THE CHAPTER SCREEN CAN BE PRACTISED ─────────────────
    Reported from a phone, and it is the sharpest of the three navigation
    reports: a learner who had finished all five Fractions lessons saw
    "Fraction Basics · Keep practising" on the chapter screen with nothing to
    tap. That concept spans lessons 1–2, and practice is offered at a concept
    BOUNDARY, so its only routes were the foot of lesson 2 or `/progress`.

    The app named a weakness and withheld the fix. Asserted as reachability
    rather than as markup, because the rule is "wherever Dagar shows a
    diagnosis it offers the treatment", not "there is an anchor here".
  */
  await page.goBack();
  await page.waitForURL(/\/learn\/[^/]+$/, { timeout: 15_000 });
  const conceptRows = page.locator('a[href^="/practice/"]');
  await expect(conceptRows.first()).toBeVisible({ timeout: 15_000 });
  await conceptRows.first().click();
  await page.waitForURL(/\/practice\//, { timeout: 15_000 });

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

  /*
    ── THE NUMBERS ON THIS SCREEN MUST AGREE WITH EACH OTHER ────────────────
    Every assertion above this line, and every one in this file before today,
    checks a FLOW: can a learner get there, is the thing on screen. All of them
    passed on the morning a learner was shown "2 days this week" above "1 day
    streak" — two answers drawn from the same activity, so one had to be wrong.

    No flow test can see that. It is a relationship between numbers, not a step
    in a journey, and it is the shape of every progress bug reported so far.

    This learner has finished exactly one lesson, today. So:
      · today's square is filled
      · the week counts one day
      · the streak reads one day
      · today's goal is closed
    Four independent code paths — `weekOfActivity`, `daysMet`, the stored streak,
    `dailyGoal` — reading one fact. If any of them disagrees, this fails, and it
    fails on the specific number rather than on "the page looks wrong".
  */
  const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

  // The square carries its IST date as its accessible name, and a met day has
  // no trailing em dash — see WeekStrip.
  const todaySquare = page.locator(`[aria-label="${today}"]`);
  await expect(todaySquare, "today's square should be filled after a lesson").toHaveCount(1);

  await expect(page.getByText(/1 day this week/i)).toBeVisible();
  await expect(page.getByText(/^1 day streak$/i)).toBeVisible();
  await expect(page.getByText(/done for today/i)).toBeVisible();

  // And the diary names the thing that moved, on the day it moved.
  await expect(page.getByText(/what moved/i)).toBeVisible();
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
  /*
    ── THE REGRESSION GUARD FOR THE BUG THIS SCREEN WAS REBUILT FOR ──────────
    EVERY chapter of the learner's class is listed, not just the first.

    Until 4 Aug the dashboard rendered `chapters[0]` and discarded the rest. It
    looked fine while each class had one chapter; the day Data Handling was
    seeded alongside Fractions, Fractions became unreachable — no screen
    anywhere rendered a link to a lesson outside the first chapter.

    So both names are asserted, not one. A test that only checked the first
    chapter is precisely the test that passed throughout the bug.
  */
  await expect(page.getByText(/data handling/i).first()).toBeVisible();
  await expect(page.getByText(/fractions/i).first()).toBeVisible();

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

  // And the curriculum actually moved. Number Play, not Integers: Class 7 opens
  // on Ganita Prakash Part 1 Ch 6, and Operations with Integers is Part 2 Ch 2.
  // The assertion that matters is that this is a DIFFERENT chapter from the one
  // Class 6 showed — a control that saves a row and leaves the learner looking
  // at the same curriculum is the bug this test exists for.
  await page.goto("/learn");
  await expect(page.getByText(/number play/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/integers/i).first()).toBeVisible();
  await expect(page.getByText(/data handling/i)).toHaveCount(0);

  /*
    ── A CHAPTER THAT IS NOT THE FIRST ONE OPENS ────────────────────────────
    Integers is Class 7's SECOND chapter, and it was the unreachable one: the
    dashboard never rendered it and `/progress` linked only to practice, so
    there was no path to an Integers lesson from anywhere in the app.

    Deliberately the second chapter and not the first — clicking the first
    would have passed all through the bug.
  */
  await page.getByRole("link", { name: /integers/i }).first().click();
  await page.waitForURL(/\/learn\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /integers/i })).toBeVisible();

  // And from the chapter, a lesson. This is the link that did not exist.
  await page.getByRole("link", { name: /lesson 1/i }).first().click();
  await page.waitForURL(/\/learn\/[^/]+\/[^/]+/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /ask a question/i })).toBeVisible();
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
