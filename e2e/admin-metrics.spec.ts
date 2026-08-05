import { expect, test } from "@playwright/test";

/**
 * `/admin/metrics` end to end.
 *
 * ── WHY THIS SKIPS BY DEFAULT ───────────────────────────────────────────────
 * The page is gated by `ADMIN_EMAILS`, which is deliberately unset in most
 * environments — the guard fails closed, so with no allowlist there is nothing
 * to test but a 404 (and that case IS tested, below, unconditionally).
 *
 * To run the full pass locally, put an address you control in a temporary
 * `.env.development.local`, sign that account up, and re-run:
 *
 *     ADMIN_EMAILS=you@example.com  (in .env.development.local)
 *     ADMIN_E2E_EMAIL=you@example.com ADMIN_E2E_PASSWORD=... npm run test:e2e
 */

const email = process.env.ADMIN_E2E_EMAIL;
const password = process.env.ADMIN_E2E_PASSWORD;
const canSignIn = Boolean(email && password);

test("the metrics page does not exist for a signed-out visitor", async ({ page }) => {
  // Unconditional, because it must hold in every environment. `proxy.ts`
  // redirects the signed-out optimistically, so this never reaches the guard —
  // which is the point: two layers, and the outer one is enough on its own.
  const response = await page.goto("/admin/metrics");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/(welcome|login)/);
});

test.describe(canSignIn ? "signed in as an admin" : "signed in as an admin (skipped)", () => {
  test.skip(!canSignIn, "Set ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD to run this.");

  test("renders the dashboard, and never names a learner", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/(learn|onboarding)/, { timeout: 15_000 });

    await page.goto("/admin/metrics");
    await expect(page.getByRole("heading", { name: "Metrics", level: 1 })).toBeVisible();

    // Every section the spec calls P0 (ANALYTICS.md §11).
    for (const heading of [
      "Where we lose people",
      "Who signed up",
      "Which chapters get used",
      "Do they come back",
      "Does Hindi hold up",
      "What they are telling us",
      "What these numbers mean",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    // ── the privacy claim, checked in the rendered output ────────────────
    // The page says it cannot see an individual learner. The aggregation is
    // unit-tested for that, but this is the thing a person actually reads.
    const body = (await page.locator("main").innerText()).toLowerCase();
    expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);

    // ── never a sideways scroll at 360px ────────────────────────────────
    await page.setViewportSize({ width: 360, height: 780 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: "e2e/__screenshots__/admin-metrics.png", fullPage: true });
  });

  test("the time-range switch changes the window", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/(learn|onboarding)/, { timeout: 15_000 });

    await page.goto("/admin/metrics");
    await page.getByRole("link", { name: "This week" }).click();
    await expect(page).toHaveURL(/window=week/);
    // The cohort note only appears on a windowed view, and it is the sentence
    // that stops somebody reading "this week" as a date filter.
    await expect(page.getByText(/follows the learners who joined/i)).toBeVisible();
  });
});

/**
 * The notifications console, and the two routes behind it.
 *
 * These matter more than the metrics guard does. `/api/admin/test-push` puts a
 * notification on a phone — so the question is not only "can a stranger read
 * numbers" but "can anyone who is not the operator make a device buzz". The
 * route answers that twice over: the admin allowlist, and then a query scoped
 * to the caller's OWN user id, so even a valid admin can only reach their own
 * handset.
 */
test("the notifications console does not exist for a signed-out visitor", async ({ page }) => {
  // Same shape as the metrics assertion above: proxy.ts redirects before the
  // guard is reached, and the outer layer is enough on its own.
  const response = await page.goto("/admin/notifications");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/(welcome|login)/);
});

test("the admin notification routes reject a signed-out caller", async ({ request }) => {
  // 404 rather than 403 — an admin surface does not confirm it exists.
  for (const path of ["/api/admin/test-push", "/api/admin/preview-summary"]) {
    const response = await request.post(path, { data: { slot: "afternoon", locale: "en" } });
    expect(response.status(), path).toBe(404);
  }
});

test("a signed-in learner cannot reach the console or fire a push", async ({ page }) => {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(`e2e_${stamp}@example.com`);
  await page.getByLabel("Password").fill("demo-password-12345");
  await page.getByRole("button", { name: "Create an account" }).click();

  // Finish onboarding, or proxy sends them there rather than to the guard —
  // which would pass this test for the wrong reason.
  await expect(page.getByRole("heading", { name: /which class are you in/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByText("Class 6", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/learn$/, { timeout: 20_000 });

  // A real session, held by someone who is not on the allowlist.
  const consoleResponse = await page.goto("/admin/notifications");
  expect(consoleResponse?.status()).toBe(404);

  for (const path of ["/api/admin/test-push", "/api/admin/preview-summary"]) {
    const response = await page.request.post(path, { data: { slot: "afternoon", locale: "en" } });
    expect(response.status(), path).toBe(404);
  }
});
