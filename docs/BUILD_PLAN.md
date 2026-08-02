# Saathi — Build Plan

## Calendar — revised 2026-07-29 for a Thursday start

| Date | Day | Focus | Hours |
|---|---|---|---|
| **Thu 30 Jul** | Day 0 **+** Day 1 | Setup, **first deploy**, auth, content, dashboard, lesson | **long — 10–12h** |
| **Fri 31 Jul** | Day 2 | Intelligence layer — grading, practice, tutor, quiz | full |
| **Sat 1 Aug** | Day 3 | Parent, observability, security, Hindi · **feature freeze at end of day** | full |
| **Sun 2 Aug** | Day 4 | Finish slips, Hindi read-through, **rehearse**, demo | until demo |

### What changed

The original plan started Day 0 on **Wed 29 Jul**. Starting Thursday compresses the
build by a day — but the deadline is **Sunday 2 Aug, 11pm**, which makes Sunday a
full working day rather than a demo morning. Thursday absorbs Day 0 + Day 1; the
rest shifts intact.

**Nothing is cut.** Full scope stands: three chapters, **Hindi for all three classes**,
chapter quiz, mentor request, WhatsApp, full metrics page, Playwright E2E. The cut
list at the bottom is a **contingency, not a plan** — it exists so that if Saturday
night goes badly you cut with a plan instead of panicking.

## Two deliverables, not one

| Due Sun 2 Aug 11pm | Where the content already exists |
|---|---|
| **Working deployed app** | This plan |
| **Deck** | Mostly written already — see below |

The deck is **assembly, not authoring**. Almost every slide already exists:

| Slide | Source |
|---|---|
| Problem, persona | `PRD.md` §2, §7 |
| Solution, MVP scope | `PRD.md` §3 · `DECISIONS.md` D1 |
| Architecture | `docs/architecture.png` — already generated |
| Market, TAM/SAM/SOM | `MARKET_AND_PRICING.md` |
| Monetisation | `DECISIONS.md` D14 |
| Hypotheses + how we measure | `DECISIONS.md` D12 |
| What we'd do next | D16 / D4 Phase 2 sections |

Budget **~90 minutes**, not half a day. Build it Saturday evening after feature
freeze while the app settles, so Sunday stays free for polish and rehearsal.

## Three rules that protect what is left

**1. Deploy on Thursday, not Saturday.** Push a barely-working app to Vercel on the
first day with every environment variable set. The classic buildathon failure is
discovering on demo day that `ANTHROPIC_API_KEY` was never added to Vercel — five
minutes to find on Day 0, fatal on Sunday. Redeploy every slice, so "it works on
Vercel" is continuously true rather than a Sunday gamble.

**2. Feature freeze at the end of Saturday.** Unchanged, and now load-bearing. After
that: bug fixes, Hindi review and rehearsal only. Work expands to fill the time
available — the freeze is the only thing keeping Sunday from becoming another build
day and leaving you demoing something you have never practised.

**3. Never leave a half-built vertical slice overnight.** A finished lesson flow
beats four half-wired screens. This matters more with no buffer: a half-slice at
midnight Saturday is a broken demo on Sunday.

> **Sunday is not for features.** Three timed run-throughs, a finished deck and a
> working fallback plan raise the score more than anything you could still build.

## If Saturday night arrives and you are behind

Do not push into Sunday. Cut in this order and protect the rehearsal:

1. Chapter quiz (2.4) → practice alone still proves the learning loop
2. Mentor request (2.6) → the struggle triggers can be described, not shown
3. WhatsApp delivery (3.2) → fall back to the in-app parent view and say the adapter
   is one config change from live (true, and an architecture strength)

Cutting on Saturday with a plan beats discovering on Sunday without one.

---

## Day 0 — Thu 30 Jul, first ~1 hour — Setup

Do this before breakfast if you can. Day 1 starts the moment it is done, **same day**.

| # | Step | Command / prompt |
|---|---|---|
| 0.1 | Bootstrap Next.js | ✅ **Done 30 Jul.** Next 16.2.12. Note: `create-next-app .` fails here because the folder is `Saathi` (npm names must be lowercase) — scaffolded to a temp dir named `saathi` and rsynced in, excluding its own `CLAUDE.md`. |
| 0.2 | Install deps | `npm i @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk zod katex react-katex twilio next-intl` |
| 0.3 | Supabase project | Create at supabase.com → copy URL, anon key, service role key into `.env.local` |
| 0.4 | Anthropic key | console.anthropic.com → `ANTHROPIC_API_KEY` in `.env.local` |
| 0.5 | Git | `git init && git add -A && git commit -m "scaffold"` |
| 0.6 | **First deploy** | ✅ **Done 30 Jul.** Live: **https://saathi-ap19.vercel.app** (scope `ap19`, project `saathi`). See below. |

### Deployment facts (0.6, 30 Jul)

**Live URL: https://saathi-ap19.vercel.app** — the stable production alias. Use this
one everywhere: the deck, Supabase redirect config, Google OAuth origins. The URL
`vercel --prod` prints (`saathi-<hash>-ap19.vercel.app`) is **per-deployment** and
changes on every push; find the stable aliases with `vercel inspect <url>`.

Env vars go in with `bash scripts/vercel-env.sh`, which pipes values from `.env.local`
into `vercel env add` on stdin so nothing is echoed to the terminal. It skips
`TWILIO_*` (empty until Day 3) and `NEXT_PUBLIC_SITE_URL` (unknowable before the first
deploy). **`NEXT_PUBLIC_` values are inlined at build time — changing one needs a
redeploy, not just a save.**

Two things that cost time and would have cost more on demo day:

- **Vercel Deployment Protection is ON by default.** *Standard Protection* covers
  generated `.vercel.app` URLs and exempts only custom domains — so production
  returned `302 → vercel.com/sso-api` and was visible only to the team. Turn
  **Require Log In** off at Project Settings → Deployment Protection. Nothing is lost:
  the boundary that protects learner data is Supabase Auth plus RLS, never Vercel's
  wall.
- **`CRON_SECRET` was still the `.env.example` placeholder.** Regenerated with
  `openssl rand -hex 32`. Check the others are real before a public deploy.

**Prompts to run in Claude Code, in order:**
> 1. Use the saathi-db skill. Write migrations 0001–0007 exactly per docs/DATA_MODEL.md, with RLS enabled and policies on every table. Then set up lib/supabase/{server,client,admin}.ts.

> 2. Use the saathi-security skill. Produce docs/security/security-plan.md, add **proxy.ts** (Next 16 renamed middleware → proxy) for session-cookie refresh and an optimistic redirect only, and set up lib/security/ with rate limiting and input validation. **The real auth boundary is the (learn)/(parent) layout server components and every route handler — Next 16 docs explicitly say proxy must not be used as a session-management or authorization solution.**

> 3. Use the saathi-test skill. Set up Vitest and Playwright with the tests/unit, tests/integration and e2e folders, and add the test scripts to package.json.

> 4. Use the saathi-design skill. Put the colour, type and spacing tokens into tailwind.config.ts and app/globals.css, load Inter + Noto Sans Devanagari, and build the shared ui/ primitives (Button, Card, Input, ProgressBar, Badge) against them.

> 5. Use the saathi-feature skill. Set up next-intl with en + hi locale files and the t(row, field, locale) helper for i18n jsonb resolution per D16. Every UI string goes through the dictionary from the very first screen — retrofitting hardcoded strings later is the expensive path.

Security and tests are scaffolded on Day 0 **on purpose**. Retrofitting either into
a finished app costs more than building around them from the start.

---

## Day 1 — Thu 30 Jul, straight after Day 0 — Curriculum spine + learning loop

**The heavy day.** Everything below lands today. Start early.

The goal by end of day: **a learner can sign up, pick a chapter, read a lesson, and
the app remembers.**

| # | Slice | Prompt |
|---|---|---|
| 1.1 | Auth + profiles | *Use the saathi-design and saathi-feature skills. Build the onboarding flow exactly as specified in docs/SCREENS.md Flow 1 — /welcome language picker, then /login (Google via Supabase OAuth primary, email fallback), then /onboarding/grade. Locale is chosen before there is a user row, so hold it in localStorage and write it to profiles.locale when the profile is created. Emit learner_registered.* **Spec: `docs/specs/auth-onboarding.md`** |
| 1.1a | **Settings screen** | *Use the saathi-design and saathi-feature skills. Build /settings with the language toggle (same picker component as onboarding), grade, display name and sign-out. Small screen, but without it a learner who picks the wrong language at onboarding is stuck.* **Spec: `docs/specs/auth-onboarding.md`** |
| 1.1b | PWA shell | *Use the saathi-feature skill. Add manifest.json with icons and display:standalone, a service worker for the app shell, and an Add-to-Home-Screen prompt per D15.* **Spec: `docs/specs/pwa-shell.md`** |
| 1.2 | Seed content | *Use the saathi-content skill. Author Class 6 Fractions — 4 concepts, 4 micro-lessons, and a question bank with 2 questions per difficulty per concept. Verify every answer key.* |
| 1.3 | Curriculum dashboard | *Use the saathi-design and saathi-feature skills. Build the curriculum dashboard as a **journey/path layout** per D17 (not a flat list): chapters for the learner's grade, visible you-are-here, lesson progress, and the recommended next lesson from lib/learning/adaptivity.ts.* **Spec: `docs/specs/curriculum-dashboard.md`** |
| 1.4 | Micro-lesson screen | *Use the saathi-design and saathi-feature skills. Build the micro-lesson screen with KaTeX rendering, in-lesson progress dots (D17), mark-complete, lesson_started/lesson_completed events, and streak update.* **Spec: `docs/specs/micro-lesson.md`** |
| 1.5 | Seed remaining 2 chapters | *Use the saathi-content skill. Author Class 7 Integers and Class 8 Solving Linear Equations to the same standard. Set `ncert_ref` on every chapter citing both NCERT editions per D1.* |
| 1.6 | **Hindi content** | *Use the saathi-content skill. Translate **all three chapters — Classes 6, 7 and 8** — into the i18n jsonb with Claude, then verify every one by reading — NCERT maths terms, Arabic numerals, KaTeX intact. Never translate answer_value.* **Spec: `docs/specs/i18n.md`** |
| 1.6b | **Hindi mechanical check** | *Use the saathi-content skill. Write `scripts/check-hindi.ts`: for every row with an `i18n.hi` entry, flag Devanagari numerals (१२३), KaTeX blocks that differ from the English source, Latin script mid-sentence, and missing NCERT maths terms. Print a table. Exit non-zero on any hit.* ~20 min. Catches everything mechanical so the Day 4 read-through is about **tone only**. |

**End-of-day check:** sign up as a Class 6 learner, complete a lesson, reload — progress persisted, streak = 1.

### Day 1 outcome (30 Jul)

✅ **All of 1.1–1.6b landed.** 3 chapters · 12 concepts · 15 lessons · 96 questions,
bilingual. End-of-day check passed: completed a lesson, streak went to 1, the
`first_lesson` badge fired, and progress survived a reload.

Two content-safety scripts now gate the curriculum, and both are proven to fail on
bad input rather than merely existing:

- `npm run check:keys` — re-derives answer keys from the STEM ONLY using exact
  rationals. 26 of 96 are pure arithmetic and all agree; the rest wait for the
  model-based cold solve in 2.1c.
- `npm run check:hindi` — maths spans, Arabic numerals, Latin script, NCERT
  vocabulary, leaked prompt scaffolding. 332 fields, 0 findings.

Hindi lives in `supabase/seed/translations/hi.json`, **in git**, and is merged into
each row's `i18n` jsonb by `npm run seed`. A translation that existed only in
Supabase would be lost on a project reset and could not be reviewed in a diff.

---

## Day 2 — Fri 31 Jul — Intelligence layer (the differentiator)

By end of day: **the full demo path works end to end.**

| # | Slice | Prompt |
|---|---|---|
| 2.1 | Grading engine | *Use the saathi-feature skill. Build lib/learning/grading.ts per DECISIONS D3 — fraction/decimal/integer/mcq/expression equivalence. `2/4`, `1/2` and `0.5` all grade correct against `1/2`.* **Spec: `docs/specs/guided-practice.md`** |
| 2.1b | **Grading tests** | *Use the saathi-test skill. Write Vitest unit tests for grading covering every answer_type, the equivalence cases, and the invalid inputs.* **Do not skip this one.** A grading bug fails silently and tells a learner they are wrong when they are right. **Spec: `docs/specs/guided-practice.md`** |
| 2.1c | **Verify answer keys** | *Use the saathi-content skill. Write `scripts/verify-answer-keys.ts`: for every seeded question, send only the stem to Claude Haiku to solve cold, compare its answer to the stored `answer_value` through `lib/learning/grading.ts`, and print a table of disagreements. Never send the stored answer in the prompt.* Runs here, not Day 1, because it needs `grade()`. Review only what it flags. |
| 2.2 | Guided practice | *Use the saathi-feature skill. Build guided practice: server-side grading, hint escalation, difficulty stepping (2 right up / 2 wrong down), instant feedback. Answer keys never reach the client.* **Spec: `docs/specs/guided-practice.md`** |
| 2.3 | AI Tutor | *Use the saathi-ai skill. Build the AI Tutor: streaming Claude Sonnet 5, grounded in the current lesson body and concept mastery, hints before answers, persist both turns, emit ai_question_asked.* **Spec: `docs/specs/ai-tutor.md`** |
| 2.4 | Mastery + chapter quiz | *Use the saathi-feature skill. Build lib/learning/mastery.ts per D5 and the chapter quiz: fixed set, no hints, mastery band on submit, recompute concept_mastery.* **Spec: `docs/specs/chapter-quiz.md`** |
| 2.5 | Progress, streaks, milestones + **daily goal** | *Use the saathi-feature skill. Build the progress screen, lib/learning/streaks.ts per D7 (Asia/Kolkata, one grace day per rolling 7, server-side only), and lib/learning/milestones.ts per D7b — award server-side and idempotently, show earned and unearned, emit milestone_earned. Add the daily goal ring per D17 — same completion rule as the streak, closable in one session.* **Spec: `docs/specs/progress-streaks.md`** |
| 2.6 | Struggle → mentor request | *Use the saathi-feature skill. Implement the three D6 struggle triggers and the mentor request flow capturing full learner context.* **Spec: `docs/specs/mentor-request.md`** |

### Content verification — both checks are green (31 Jul)

| Check | Covers | Result |
|---|---|---|
| `npm run check:keys` | 26 arithmetic stems, re-derived exactly, free | 0 disagreements |
| `npm run verify:answers` | **all 96**, solved cold by Haiku, compared through `grade()` | **96 agreed, 0 disagreed** |

The stored answer is never sent to the model — a model shown the answer agrees with
it, which would make the whole check theatre.

100% agreement is better than the 5–10% first-pass flag rate `saathi-content`
predicts, so both checks were **proved able to fail** before being believed:
corrupting an integer key and an MCQ key was caught in each case, and each script
exits non-zero.

**End-of-day check:** full journey — dashboard → lesson → tutor → practice → quiz → progress — works on a phone.

---

## Day 3 — Sat 1 Aug — Parent, polish · **feature freeze at end of day**

| # | Slice | Prompt |
|---|---|---|
| 3.1 | Parent link | *Use the saathi-feature skill. Build the 6-char parent link code flow and the read-only parent view per D2. Parent locale defaults to the learner's on claim and is switchable in the parent view (D16). Verify a parent cannot write and cannot read an unlinked student.* |
| 3.2 | Notify layer | *Use the saathi-feature skill. Build lib/notify with the channel-agnostic sendParentSummary interface, a Twilio WhatsApp sandbox adapter, an in-app adapter, and an SMS stub documented as DLT-blocked.* |
| 3.2b | **Reminder notifications** | *Use the saathi-feature skill. Web Push through the existing service worker: opt-in after a first lesson, one a day, skipped when the goal is already met, tapering after the first week. Encouraging copy only — no countdowns, no streak-loss language (D17b).* **Spec: `docs/specs/reminders.md`** |
| 3.3 | Weekly summary | *Use the saathi-ai skill. Generate the weekly parent summary with Haiku 4.5 from real progress data — lead with any milestones earned that week (D7b) — in the **parent's** locale, delivered on a Vercel cron, with the tracking token for parent_summary_viewed.* |
| 3.4 | Metrics + health page | **PART DONE 31 Jul — page DEFERRED to 1–2 Aug.** Instrumentation is finished: `parent_summary_sent`, `dashboard_viewed` and `recommendation_clicked` now all emit (none of them did before, which made two PRD §12 metrics uncomputable). Still to build: a fail-closed admin guard (no admin role exists — `ADMIN_EMAILS` allowlist), the aggregation layer, and `/admin/metrics` itself. ~45–60 min. Wanted as a **PM clarity tool**, not a demo asset, so it may land after the deadline. |
| 3.5 | AI logging + feedback | *Use the saathi-observe skill. Add lib/analytics/ai-log.ts writing one ai_calls row per model call (never failing the request), and a thumbs up/down control on every tutor response writing to tutor_feedback.* |
| 3.6 | Security + RLS tests | *Use the saathi-security skill to review every route and table, then the saathi-test skill to write integration tests that attempt the RLS violations and assert they fail.* |
| 3.7 | Hindi pass | *Use the saathi-design skill. Walk every screen in Hindi at 360px — Devanagari at 18px/1.75, no clipped buttons (Hindi runs 10–20% longer), no untranslated strings. Verify the tutor and the parent summary both reply in Hindi.* |
| 3.8 | E2E + a11y + mobile | *Use the saathi-test skill for one Playwright test covering the demo path, then the saathi-ship skill gates 3 and 4.* |
| 3.9 | **Draft the deck** | *~90 min, after feature freeze. Assemble from PRD §2/§3/§7, docs/architecture.png, MARKET_AND_PRICING.md, DECISIONS D12 and D14. Do not write new content — it already exists.* |
| 3.10 | Demo data + deploy | *Use the saathi-ship skill. Seed demo accounts with realistic partial progress, run all gates, deploy to Vercel.* |

---

## Deck & docs — decided, not yet written up (1 Aug)

**Evidence the adaptivity from the data, not from a screenshot.** The ladder is
invisible in the UI until 4.1c ships, and may not ship — but it is provable from
`attempts` either way, and a number beats a claim:

> "Across one practice set the ladder moved from difficulty 1 to 3 as the learner
> got things right, and stepped back down when they didn't. Adaptivity isn't a
> claim in the deck — it's in the attempts table."

Costs nothing, survives 4.1c being cut, and answers the question a judge is most
likely to ask about an "adaptive" product.

Not code. Do these while assembling the deck (3.9), not before feature freeze.

**Broaden the secondary persona to parent / guardian / tutor.** The PRD already
says "Parent / Guardian"; **tutor** is the addition, and it is the strongest of
the three for this audience. The PRD's own problem statement says parents "lack
subject expertise" — a tutor is exactly the adult who has it, and private tuition
is near-universal in this demographic.

The abstraction to name is not a list of three words but **"a supporting adult
the learner chooses"**, which is what the product already implements: the child
mints the code and hands it over, so consent flows from the child. That framing
also answers the safeguarding question before it is asked — widening the persona
does not widen the attack surface, because the gate was never "are you the
parent", it was always "did the child give you this".

GTM line worth a slide: a tutor with fifteen students is a fifteen-learner
acquisition unit, which beats signing up parents one at a time.

Touch: PRD §Secondary Persona, §6.2 JTBD, §value proposition, H6; deck persona
and market slides; one line on `/for-parents`.

**Do not touch:** `profiles.role = 'parent'` (a stored value read by RLS
policies — renaming it is a migration and a policy rewrite for zero user-visible
gain), the `/parent` routes, or a copy sweep through every string ("parent,
guardian or tutor" breaks a button, and Hindi already runs 10–20% longer).

Caveat to write down rather than paper over: a parent wants "is my child okay";
a tutor wants "what do I teach on Tuesday". Same data, different emphasis. One
summary serves both adequately in MVP — call the divergence a Phase 2 item, not a
solved problem. We have never tested with a tutor.

Note: Hindi needs no change — **अभिभावक** already means guardian in the broad
sense and is the standard register, so the Hindi copy is already the inclusive one.

---

## Day 4 — Sun 2 Aug — Finish, rehearse, demo

A full working day — deadline is **11pm**. Catch-up, Hindi, rehearsal, deck and
submission. Work 4.1–4.8 **in order** and stop adding features.

**Feature freeze is in effect.** No new features. In order:

| # | Task | Notes |
|---|---|---|
| 4.1 | **Finish whatever slipped** | Most builds need this. **Hard stop at 4pm** — after that, cut it and demo around it rather than debugging into the submission window. |
| 4.1b | **"Very close — write it as a fraction"** *(agreed 1 Aug, ~40 min)* | A decimal that is close but outside tolerance on a NON-TERMINATING answer currently gets a flat "not quite". For `5/12`, that means `0.42` is rejected with no clue that the maths was right and only the form was wrong. Add a distinct grade reason, pass it through `/api/attempts`, render a specific message, copy in both languages, tests. **Correctness itself does not change** — `0.42` stays wrong, because it is wrong; only the feedback improves. Do it AFTER 4.2 and 4.3; `grading.ts` is the highest-harm file in the product and this is not worth a rushed edit. Cut it without hesitation if the morning runs late. |
| 4.1c | **Make the adaptive ladder visible** *(agreed 2 Aug, ~30 min)* | Practice steps difficulty 1→3 after two right and back down after two wrong, and a learner cannot perceive any of it — the product's central claim is invisible on the screen where it happens. Show the MOVEMENT, never the level: **"Nice — let's try a harder one"** when it steps up, and **nothing at all** when it steps down. A visible "Level 1" is a rank, which design rule 12 forbids, and "here's an easier one" is a demotion notice to a child who just got two wrong. Asymmetric on purpose. `/api/attempts` already returns the next difficulty, so this is a comparison, one line of copy in each language, and a test. **The quiz is deliberately excluded** — its set is fixed at start so scores stay comparable between attempts, and there is no adaptation there to show. Cut without hesitation if the morning runs late; the deck line below evidences the same thing for free. |
| 4.2 | **Hindi read-through** — the one manual content task | Run `npm run check:hindi` first so everything mechanical is already fixed, then read every lesson and question stem for **tone only**: does this sound like the NCERT textbook, and would a 12-year-old read it easily? ~65–80 min for all three chapters. **Show it to one Hindi-speaking child or parent if you can** — ten minutes of that beats every rule in the guide. |
| 4.3 | Full journey on a real phone against the **live** URL | Signup → lesson → tutor → practice → quiz → progress → parent link, in **both languages**. Deploy itself is routine by now — you have been deploying since Day 0. |
| 4.4 | Seed demo accounts | Realistic partial progress: a 4-day streak, one chapter part-done, two weak concepts. **Purge development test data first** — `learner1@saathi.test` and `learner2@saathi.test` were created on Day 1 to verify slice 1.1, and their `learner_registered` rows in `events` would inflate the activation number on the metrics slide. Delete the users **and** their event rows (`events.student_id` is `on delete set null`, so removing the user leaves the event behind). |
| 4.4b | **Reset the WhatsApp window — 1–2 hours before the demo** | Send any WhatsApp message ("hi") from the parent phone to the Twilio sandbox number. WhatsApp only permits a business-initiated free-form message within **24 hours** of the user's last inbound one, and the sandbox cannot register a template to work around it. Sandbox *membership* lasts 72h, which is the number people remember and is not the one that bites. Five seconds, and skipping it is how the WhatsApp moment fails live. |
| 4.5 | **Rehearse the demo three times, out loud, timed** | Most under-valued hour of the build — and the first thing that gets skipped when a buffer disappears. Do not skip it. |
| 4.6 | Write the fallback plan | What you say and show if wifi dies or the tutor times out mid-demo |
| 4.7 | **Finish the deck** | Drafted Saturday (3.6b). Add real screenshots from the deployed app and the actual metrics numbers. |
| 4.8 | **Submit — app URL + deck** | Deadline **Sun 2 Aug, 11pm**. Submit by 9pm; the last two hours are for the thing that goes wrong. |

If Sunday runs ahead of schedule, **rehearse again and polish the deck**. Do not start anything new on the last day — an untested feature added hours before submission is how a working demo breaks.

---

## Cut list — contingency only, nothing is pre-cut

**Do not cut anything preemptively.** This list exists so that *if* Saturday night
goes badly you cut with a plan rather than panicking. Sacrifice in this order:

| Order | Cut | What you still have |
|---|---|---|
| 1 | `/admin/metrics` (3.4) | Nice demo asset, zero user value — the events still record |
| 2 | Playwright E2E (3.8) | Vitest unit tests, which catch more per minute |
| 3 | WhatsApp delivery (3.2) | In-app parent view; the adapter is one config change from live |
| 4 | Chapter quiz (2.4) | Practice alone proves the learning loop |
| 5 | Class 8 content entirely (1.5) | Two grades — costs the "full range" story, nothing else |

**Never cut, at any point:**

- Dashboard, micro-lesson, AI tutor, guided practice — that four-step loop *is* the
  product. Everything else is evidence for it.
- **Hindi UI strings and the Hindi tutor.** ~2.5h combined, and they are the
  accessibility story. Cutting them contradicts the product's premise.

## Naming — decided 1 Aug, deliberately deferred

"Saathi" is already used by at least one other product. **Not changing it before
submission**, and the trigger for revisiting is specific rather than vague: **when
this moves to a real APK / app-store listing**, alongside advanced features.

That is the point where the name starts to cost something — store listings enforce
collisions, and a trademark and domain check belongs in the same piece of work.
Before then it is cosmetic, and साथी is an ordinary Hindi word meaning companion,
which is why several products share it and why nobody holds a strong exclusive
claim on it.

Measured blast radius, so the next person does not have to: **56 user-visible
strings** across both message dictionaries, **4 in the AI prompts** — including the
tutor's own identity, which is the one that needs care — 40 across app/ and
components/, 2 icons/manifest, and 129 in docs. Roughly 90 minutes with the test
suite as a safety net, plus a URL change that breaks any link already shared.

---

## After the demo — the first real week

The build plan ends at deploy; the product doesn't. In priority order:

0. **Widen the quiz bank — the first content task.** Reported from real use on
   1 Aug: *"I was trying the quiz again for fractions, the questions were
   repetitive, there was no new question."* Correct, and not a code bug — there
   are **8 quiz questions per chapter and the quiz is all 8 of them**, so a
   retake cannot contain anything new.

   Shipped that day: order now varies per attempt (`orderQuizQuestions`), which
   stops a third retake being a memory test. That is the cheap half.

   The real fix is more questions — 2 per concept becomes 4, so the quiz can
   serve a random 8 from a bank of 16. **Honest estimate: 5–6 hours for all three
   chapters** — 2.5–3h authoring stems, answer keys and worked solutions, 45m
   Hindi, 45m key verification, 45m for the selection code and tests, 30m
   re-seed and check. Roughly **1.5–2h for Class 6 alone** if only the demo
   chapter matters.

   The bottleneck is not writing them, it is that every `answer_value` must be
   right: a wrong key marks a correct learner wrong, silently, and this repo has
   two separate key-checking scripts because of it. Not a job to rush.

0b. **Decide what a rounded decimal should do on a recurring answer.**
   Grading compares decimals within `TOLERANCE = 1e-6`, which is right for exact
   values — `0.6` matches `3/5`, `0.5` matches `1/2`. On a non-terminating one it
   quietly demands six decimal places: for `5/12`, `0.42` `0.417` `0.4167` and
   `0.41667` are all wrong, and only `0.416667` passes.

   That is arithmetically correct and pedagogically unhelpful. A learner who
   works out 5/12 as a decimal writes `0.42`, is marked wrong, and learns
   nothing about why.

   NOT fixed on 1 Aug on purpose: `grading.ts` is the highest-harm file in the
   product — a loosened tolerance marks genuinely wrong answers correct — and
   feature-freeze evening is the wrong time to touch it. The interim fix was to
   stop the hint advertising decimals.

   Worth considering: when a decimal is close but outside tolerance AND the
   expected value is non-terminating, treat it as "not quite — write it as a
   fraction" rather than a plain wrong. That teaches the actual point of the
   chapter instead of failing them on rounding.

0c. **Slash the inline fractions.** A stacked `\frac` inside running text has no
   good size: large enough to read the digits and it crowds the lines around it;
   small enough to sit in the line and the digits fall to ~12px, under the
   caption floor. Both were tried on 1 Aug and both were reported as wrong from a
   real phone within the hour.

   The fix is not a size. Typesetting solves this by writing inline fractions
   **slashed** — `1/4` on one line — and reserving stacked ones for display
   maths, which has the vertical room. It removes the problem rather than
   trading its two symptoms.

   A content change: inline `$\frac{a}{b}$` becomes `$a/b$` across three
   chapters, in both languages, leaving every `$$…$$` display block alone.
   Mechanical but wide, and it touches the Hindi files, so it needs
   `npm run check:hindi` after. **Not a deadline-week edit.**

1. **Write the tutor golden set** (~30 min) — 20–30 real learner questions with a
   rubric. *Use the saathi-observe skill.* Until this exists, every prompt edit is
   an untested deploy.
1b. **"See their practice" — questions and answers for a supporting adult.**
   Decided 31 Jul as a wanted feature, deliberately deferred. A new screen off
   `/parent` (and off `/s/[token]` — **one screen for every supporting adult**,
   whether parent, guardian, tutor or older sibling; the door they came through
   must never change what they see) listing questions practised and what the
   learner answered.

   **The trap, and the reason this is not a 20-minute job:** showing what the
   learner answered is easy; showing *the correct answer beside it* means a
   parent-role account reading `questions.answer_value`, which today no signed-in
   user can read at all. Grant that to the parent role and a learner who signs up
   with a second email has the whole answer key. It has to follow the
   `/s/[token]` pattern — the server assembles a fixed, safe payload and the
   browser never holds a key it could reuse.

   The RLS access this needs already exists and was left open on purpose: a
   linked parent can read `attempts` (see `tests/integration/privacy-promise.test.ts`).
   The tutor conversation is NOT part of this and never will be — migration 0017.
2. **Check the health queries daily** — cache-read ratio and cost/learner first.
   Caching silently not working is the single most likely cost surprise.
3. **Read the thumbs-down responses.** Ten of them will teach you more about the
   tutor than any dashboard.
4. **Find the lesson generating the most tutor questions.** It is usually a badly
   written lesson, not a hard concept.
5. **Start DLT registration.** Multi-day, needs a registered business entity, and it
   gates both parent SMS and phone-OTP login. Nothing in the code changes when it
   clears — start the clock early (D4 Phase 2).

Then the two Phase 2 workstreams already decided: **WhatsApp Cloud API** off the
sandbox (D4), and **natively authored Hindi lessons** with the content-model change
that requires (D16). Neither is a demo-week task.

## Demo narrative (5 min)

1. **Problem, 30s** — underserved learner, no tutor, parent can't help.
2. **Learner journey, 2 min** — dashboard → lesson → ask the tutor a genuinely
   confused question → tutor hints instead of answering → practice adapts → quiz
   shows mastery.
3. **The differentiator, 1 min** — show the tutor *knowing* which concept is weak.
   This is what separates Saathi from ChatGPT with a syllabus.
4. **Parent, 1 min** — WhatsApp summary arriving on a real phone, live.
   > **Setup, not optional:** the demo phone must send `join <code>` to the Twilio
   > sandbox **on the day**. The sandbox session expires after 3 days and free-form
   > sends need the 24h reply window (D4) — a phone that joined on Friday will
   > silently fail on Sunday. Re-join immediately before you present, and keep the
   > in-app `/parent` view open in a second tab as the fallback.
5. **Validation, 30s** — the metrics page. You built the measurement, not just the features.

## Constraints worth naming out loud

Judges rate "understood the constraint" far above "avoided the topic." Each of these
is a real limit we hit, researched, and designed around — say them as decisions, not
apologies. Two or three is plenty; do not recite the list.

**WhatsApp** — *"WhatsApp is where these parents are, so that's what we built for.
We're on Twilio's sandbox, which expires a parent's session after three days and
won't allow custom templates — fine for this demo, structurally unable to carry a
weekly summary. So the in-app parent view is the real channel for our pilot, and
WhatsApp Business is gated on Meta verification, which is paperwork, not
engineering. The notify layer is channel-agnostic: in-app, WhatsApp and SMS are
three adapters behind one interface."*

**SMS and phone login** — *"India's TRAI mandates DLT registration for any automated
SMS. That blocks both parent SMS and phone OTP login, so Google Sign-In is primary —
on a shared Android phone it's already signed in. The SMS adapter is written and
stubbed; it's one config change when DLT clears."*

**Distribution** — *"It's an installable PWA, not an APK. Play Store needs a 14-day
closed test with 12 testers — longer than the build. The same PWA wraps into a
Trusted Web Activity for the store later, with no rewrite."*

**Curriculum** — *"NCERT is mid-rollout of Ganita Prakash, and Class 8's linear
equations chapter no longer exists as a chapter. Both editions are in schools right
now, and underserved schools get new books last — so we anchored content to the
concept and cite both editions."*

**Grading** — *"Our grader treats 2/4, 1/2 and 0.5 as the same answer, because a
learner who writes 2/4 understood it. That breaks any question whose point is
reducing a fraction — so we changed the question design rather than weakening the
grader."*
