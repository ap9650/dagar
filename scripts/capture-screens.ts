/**
 * npm run deck:shots — real screenshots of the real app, at the size it is used.
 *
 * The deck described eight features in words and showed the product not once.
 * A judge reading "guided practice with pictorial input" has to take our word
 * for it; a judge looking at a 360px phone screen with a shaded fraction bar on
 * it does not.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT DRIVES THE APP. IT DOES NOT MOCK IT.
 *
 * Every image below is produced by signing in as the demo learner and walking to
 * the screen. Nothing is composited, no state is injected, and no answer key is
 * read. If a screen is broken, the screenshot is of the broken screen — which is
 * the property that makes these worth putting in front of anyone.
 *
 * The password is read from `.env.local` by this process and never printed.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Requires `npm run dev` on :3000 (or PLAYWRIGHT_BASE_URL).
 *
 * RUN `npm run demo:data` FIRST. Walking practice leaves attempts behind, and
 * attempts move the adaptive selector — so a second run without a reset serves
 * different questions and can miss the pictorial ones this is here to
 * photograph. Reset first and the run is reproducible.
 */
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/deck/screens";

/** 360px is the design width. ×3 so the deck can scale them without mush. */
const VIEWPORT = { width: 360, height: 760 };
const SCALE = 3;

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      if (!/^[A-Z]/.test(line)) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      out[line.slice(0, eq)] = line.slice(eq + 1).replace(/\s+#.*$/, "").trim();
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...out, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const EMAIL = env.DEMO_EMAIL ?? "demo@saathi.app";
const PASSWORD = env.DEMO_PASSWORD;

if (!PASSWORD) {
  console.error(
    "No DEMO_PASSWORD in .env.local. Run `npm run demo:data` and save the printed\n" +
      "password as DEMO_PASSWORD — this script never invents credentials.",
  );
  process.exit(1);
}

/**
 * `/practice/[concept]` takes a concept UUID, not the slug the seed authors in.
 * Resolved here with the service role because a plain Node process has no
 * learner session — it reads curriculum only, never a learner row and never an
 * answer key.
 */
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const conceptIds = new Map<string, string>();

async function conceptId(slug: string): Promise<string> {
  if (conceptIds.has(slug)) return conceptIds.get(slug)!;
  const { data } = await db.from("concepts").select("id").eq("slug", slug).maybeSingle();
  if (!data) throw new Error(`no concept "${slug}" — has npm run seed been run?`);
  conceptIds.set(slug, data.id as string);
  return data.id as string;
}

const shots: string[] = [];

async function shot(page: Page, name: string) {
  // Viewport, not full page. A full-page dashboard is 4,800px tall — four and a
  // half phone screens — and scaled onto a slide it is a grey smear. One screen
  // at the size a learner sees it is the thing worth showing.
  await page.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
  console.log(`  ✓ ${name}`);
}

/**
 * Dismiss the install prompt before photographing the dashboard.
 *
 * It is a correct piece of product — a PWA nobody installs is a website — but
 * it is a first-visit card, and it filled two-thirds of the first screenshot,
 * pushing the journey path (the thing worth showing) below the fold. Dismissing
 * it is what a returning learner has already done.
 */
async function dismissInstallCard(page: Page) {
  const close = page.getByRole("button", { name: /not now/i });
  if (await close.count()) {
    await close.click();
    await page.waitForTimeout(300);
  }
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  // Google is the primary path; the email form is behind a disclosure.
  const emailOption = page.getByRole("button", { name: /use email instead/i });
  if (await emailOption.count()) await emailOption.click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.waitForURL(/\/learn$/, { timeout: 20_000 });
}

/**
 * What kind of answer input is on screen.
 *
 * Read from the ACCESSIBLE names the components already expose, not from class
 * names — a styling change should not silently stop this script from finding
 * the pictorial questions it exists to photograph.
 */
async function inputKind(page: Page): Promise<string> {
  if (await page.getByRole("group", { name: "Answer tiles" }).count()) return "tiles";
  if (await page.getByRole("radio", { name: /^The option showing/ }).count()) return "choiceViz";
  if (await page.getByRole("checkbox", { name: /^Part \d/ }).count()) return "shade";
  if (await page.getByRole("slider").count()) return "place";
  return "text";
}

/**
 * Block until the session is back in the ANSWERING phase.
 *
 * This is the whole difficulty of walking practice from the outside. A graded
 * question keeps its controls on screen but disabled, so a click issued a beat
 * too early does not fail fast — it hangs for the full timeout and then reports
 * "element is not enabled", which reads like a broken widget rather than a race.
 *
 * "Check answer" is rendered only in the answering phase, so its presence is the
 * phase. Waiting on it rather than on a sleep is what turned six flaky attempts
 * into one that runs the same way every time.
 */
async function answering(page: Page) {
  await page.getByRole("button", { name: /check answer/i }).waitFor({ timeout: 25_000 });
}

/** Put *something* in the answer, whatever the input kind is. */
async function answerAnything(page: Page, kind: string) {
  if (kind === "tiles") {
    await page.getByRole("group", { name: "Answer tiles" }).getByRole("button").first().click();
  } else if (kind === "choiceViz") {
    // The radio is `sr-only` under its label — the 92px card is what a thumb
    // hits, and clicking the input directly is intercepted by the tick.
    await page
      .getByRole("radio", { name: /^The option showing/ })
      .first()
      .locator("xpath=ancestor::label[1]")
      .click();
  } else if (kind === "shade") {
    await page.getByRole("checkbox", { name: /^Part 1/ }).click();
  } else if (kind === "place") {
    await page.getByRole("slider").press("ArrowRight");
  } else {
    // A plain question is either a written answer or a lettered MCQ. The MCQ
    // radios are `sr-only` under their labels, same as everywhere else.
    const radio = page.locator('input[type="radio"]').first();
    if (await radio.count()) {
      await radio.locator("xpath=ancestor::label[1]").click();
    } else {
      await page.getByRole("textbox").first().fill("1");
    }
  }
}

/**
 * Walk a practice set until a question of `want` appears, and photograph it.
 *
 * The walk answers and moves on rather than reloading, because practice
 * selection is deterministic for a given learner — reloading serves the same
 * question forever, which cost me six attempts to learn the first time.
 */
async function practiceShot(
  page: Page,
  concepts: string[],
  want: string,
  name: string,
  opts: { stem?: boolean } = {},
) {
  for (const concept of concepts) {
    if (await walkConcept(page, concept, want, name, opts)) return;
  }
  console.log(`  ✗ ${name} — no "${want}" question surfaced in ${concepts.join(", ")}`);
}

async function walkConcept(
  page: Page,
  concept: string,
  want: string,
  name: string,
  opts: { stem?: boolean },
): Promise<boolean> {
  await page.goto(`${BASE}/practice/${await conceptId(concept)}`);
  await answering(page);

  for (let i = 0; i < 12; i++) {
    const kind = await inputKind(page);
    // The balance by its own accessible name.
    //
    // This was `getByRole("img").count() > 0` for one run, and it matched
    // something else on the page — so it photographed a plain `3x = 21` and
    // reported it as the stem-diagram screen. A detector that can pass without
    // the thing it is detecting is worse than no detector: it produced a
    // green line of output for a screenshot that proved nothing.
    const hasStem = (await page.getByRole("img", { name: /^A balance:/ }).count()) > 0;
    if (kind === want && (!opts.stem || hasStem)) {
      await page.waitForTimeout(250);
      await shot(page, name);
      return true;
    }

    await answerAnything(page, kind);
    await page.getByRole("button", { name: /check answer/i }).click();
    const next = page.getByRole("button", { name: /next question|finish practice/i });
    await next.waitFor({ timeout: 15_000 });
    if (/finish/i.test((await next.textContent()) ?? "")) break;
    await next.click();
    await answering(page);
  }

  return false;
}

/** A lesson step that carries a diagram, which is the whole point of D18. */
async function lessonShot(page: Page, name: string) {
  await page.goto(`${BASE}/learn`);
  // By href, not by label: this runs in Hindi too, where the recommendation
  // reads "यहाँ से शुरू करें".
  await page.locator('a[href^="/learn/"]').first().click();
  await page.waitForURL(/\/learn\/[^/]+\/[^/]+/, { timeout: 20_000 });

  for (let step = 0; step < 12; step++) {
    if (await page.getByRole("img", { name: /.+/ }).count()) {
      await page.waitForTimeout(250);
      await shot(page, name);
      return;
    }
    const cont = page.getByRole("button", { name: /^continue$/i }).first();
    if (!(await cont.count())) break;
    await cont.click();
    await page.waitForTimeout(300);
  }
  console.log(`  ✗ ${name} — no diagram step found`);
}

async function setGrade(page: Page, grade: number) {
  await page.goto(`${BASE}/settings`);
  // By VALUE, not by the visible label: this runs again after the locale has
  // been switched, and "Class 6" is "कक्षा 6" by then. The label is the target a
  // thumb hits, so click that — the radio itself is sr-only.
  const already = await page
    .locator(`input[name="settings-grade"][value="${grade}"]`)
    .isChecked();
  if (already) return;
  await page
    .locator(`input[name="settings-grade"][value="${grade}"]`)
    .locator("xpath=ancestor::label[1]")
    .click();
  // The control is optimistic, so `toBeChecked` passes before the write lands.
  // Wait on the PATCH itself — this exact race failed one e2e run in two.
  await page.waitForResponse(
    (r) => r.url().includes("/api/profile") && r.request().method() === "PATCH",
    { timeout: 15_000 },
  );
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context: BrowserContext = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // A silent failure here looks identical to a slow one — the answer controls
  // are disabled while the session is busy, so a dead fetch reads as a 30s
  // timeout on a click. Surface the cause instead of guessing at it.
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`    [console] ${m.text()}`);
  });
  page.on("requestfailed", (r) => console.log(`    [netfail] ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) console.log(`    [http ${r.status()}] ${r.url()}`);
  });

  try {
    await login(page);

    console.log("Class 6 — English");
    await page.goto(`${BASE}/learn`);
    await page.waitForTimeout(600);
    await dismissInstallCard(page);
    await shot(page, "dashboard-en");

    await lessonShot(page, "lesson-step");
    // Several concepts per shot: a practice set is five questions chosen
    // adaptively, so whether the one pictorial question in a concept lands in
    // it depends on the learner's history. Trying the concepts that carry that
    // kind is what makes the run repeatable rather than lucky.
    await practiceShot(
      page,
      ["fraction-basics", "comparing-fractions", "equivalent-fractions"],
      "choiceViz",
      "practice-choiceviz",
    );
    await practiceShot(page, ["equivalent-fractions"], "tiles", "practice-tiles");
    await practiceShot(page, ["fraction-basics", "equivalent-fractions"], "shade", "practice-shade");

    await page.goto(`${BASE}/progress`);
    await page.waitForTimeout(600);
    await shot(page, "progress-en");

    console.log("Class 8 — the balance beside the stem");
    await setGrade(page, 8);
    await practiceShot(
      page,
      ["solving-one-side", "variable-both-sides", "linear-equation-basics"],
      "tiles",
      "practice-balance",
      { stem: true },
    );

    console.log("Hindi");
    await context.addCookies([
      { name: "saathi_locale", value: "hi", url: BASE },
    ]);
    await setGrade(page, 6);
    await page.goto(`${BASE}/learn`);
    await page.waitForTimeout(600);
    await shot(page, "dashboard-hi");
    await lessonShot(page, "lesson-step-hi");
  } finally {
    // Leave the demo learner exactly as found — Class 6, English. A capture run
    // that quietly reassigns the demo account to Class 8 is a landmine for
    // whoever demos next.
    //
    // By NAME. A bare clearCookies() takes the Supabase session with it, so the
    // restore below redirected to /login and reported a failure it had itself
    // caused.
    await context.clearCookies({ name: "saathi_locale" });
    try {
      await setGrade(page, 6);
    } catch {
      console.log("  ! could not restore Class 6 — run `npm run demo:data`");
    }
    await browser.close();
  }

  console.log(`\n${shots.length} screens → ${OUT}/`);
}

await run();
