import { test, expect } from "@playwright/test";

/**
 * The demo path — the single E2E test that matters (saathi-test skill).
 *
 * Currently a placeholder: the screens do not exist yet. Each step is written as
 * a skipped assertion so the file grows into a real test as slices land, rather
 * than being written from scratch under pressure on Day 3.
 *
 * Fill these in as you go:
 *   1.1  → sign-up + language picker
 *   1.3  → dashboard
 *   1.4  → micro-lesson
 *   2.2  → practice
 *   2.3  → tutor
 *   2.4  → quiz
 *   2.5  → progress + streak
 *
 * Stub the Anthropic call in CI so the suite is neither billed nor flaky.
 */

test("the app is up", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
});

test.describe("demo path", () => {
  test.fixme("language picker is the first screen a new learner sees", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByRole("button", { name: "English" })).toBeVisible();
    await expect(page.getByRole("button", { name: "हिंदी" })).toBeVisible();
  });

  test.fixme("sign up → dashboard → lesson → tutor → practice → quiz → progress", async () => {
    // Slices 1.1 through 2.5.
  });
});
