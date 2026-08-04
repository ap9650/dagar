# Analytics — events and the metrics dashboard

**Owner:** Akriti Panwar (CEO / product lead)
**Status:** events complete and live; dashboard specified, not yet built
**Last revised:** 4 August 2026

---

## 0. What this document is

The single reference for two pieces of work that only make sense together:

1. **The event layer** — what Dagar records, where each event fires, and how it
   must be counted.
2. **The metrics dashboard** (`/admin/metrics`) — what those events are turned
   into on screen, for whom, and what each number is allowed to claim.

They are one document because they fail as two. An event nobody reads is dead
weight; a number with no event behind it reads **zero** and looks like an
answer. That has already happened here once — `dashboard_viewed` sat in a metric
definition for weeks with nothing emitting it, so Recommendation Acceptance was
uncomputable and nobody noticed until someone went looking for the figure.

**If you are building either piece, this document is the brief.** It does not
restate `DATA_MODEL.md` (schema), `DECISIONS.md` (why the product works this
way) or the PRD (strategy) — it references them.

### The rule that keeps this honest

> Every number on the dashboard names the events it is made of, and every event
> in the catalogue names a number it feeds. Anything that fails both tests gets
> deleted from this document, not left in.

---

## 1. Who reads the dashboard

One page, read top to bottom, serving two people who happen to be the same
person wearing different hats. This is a deliberate structure, not a compromise.

| | **The CEO view** (§6) | **The product-lead view** (§7) |
|---|---|---|
| Question | *Is this working, and should we keep going?* | *What exactly is broken, and where?* |
| Time to answer | 20 seconds | 10 minutes |
| Grain | 6 numbers with a direction | Stage-by-stage, chapter-by-chapter |
| Used for | The deck, the pitch, go/no-go | This week's fix |
| Position | Top of the page, above the fold at 360px | Everything below |

The CEO view must be **quotable without a caveat**. If a number needs an
asterisk to be honest, the asterisk goes next to it, or the number does not
appear up there. A figure that needs explaining is a product-lead figure.

---

## 2. Principles

**1. Privacy is a boundary, not a preference.** Dagar's users are 11–14. India's
DPDP Act 2023 §9(3) prohibits tracking and behavioural monitoring of a child
*even with parental consent*, and the DPDP Rules 2025 Schedule IV exemptions for
educational institutions are purpose-bound and explicitly do not cover analytics
or profiling. Everything below is designed inside that line:

- **No third-party analytics.** No PostHog, no GA, no script that fingerprints a
  child or follows them across sites. The events table is ours, in our database,
  in a project we control.
- **No individual learner ever appears on the dashboard.** Counts only. See §9.
- **Props carry no PII and no free text a learner typed** — enforced at the type
  level and scrubbed at runtime in `lib/analytics/track.ts` (14 forbidden keys,
  64-character cap).
- **Pre-account events carry no identifier at all** — see §4.

**2. Server-side truth.** Events that a learner could profit from faking are
emitted by the route handler that performed the write. `/api/events` accepts
exactly four names from a browser, and none of them are completions, streaks or
milestones. See §3.4.

**3. Analytics never breaks a lesson.** `track()` fails open — a failed insert is
logged and swallowed. The cost of that choice is that data can be lost in
silence, which is why §5 exists and why the dashboard is verified against
counted rows rather than read code.

**4. Plain words, not event names.** "Finished a lesson", never
`lesson_completed`. Every figure carries a definition on the page (§8). You
should never need the schema in your head to read your own dashboard.

**5. Say what a number cannot say.** Known distortions are printed next to the
figure, not buried here. See §5 and §10.

---

## 3. The event catalogue

The canonical names live in `EVENT_NAMES` in `lib/analytics/track.ts`, where an
off-list name is a **compile error**. This table is what each one means.

### 3.1 Before an account exists

| Event | Fires | Props | Feeds |
|---|---|---|---|
| `welcome_viewed` | `/welcome` server render, no session | `locale` | Funnel stage 1 |
| `login_viewed` | `/login` server render, no session | `locale`, `failed` | Funnel stage 2 |

Written by `trackAnonymous` with `student_id` **null**. See §4.

### 3.2 Getting started

| Event | Fires | Props | Feeds |
|---|---|---|---|
| `onboarding_started` | `/onboarding/grade` render, session but no profile | `locale` | Funnel stage 3 — signup drop-off |
| `learner_registered` | `POST /api/profile`, **create only** | `grade`, `locale` | Funnel stage 4, language split, cohort size |
| `settings_changed` | `PATCH /api/profile` | `field`, `locale` | Language switching (D16 evidence) |

`onboarding_started` covers **both** ways in — Google returns through
`/auth/callback`, email+password through a confirmation link, and they converge
on the grade picker. It fires there rather than in the auth routes for that
reason, and because the grade picker has a session to attribute it to.

### 3.3 Learning

| Event | Fires | Props | Feeds |
|---|---|---|---|
| `dashboard_viewed` | every `/learn` render | `recommendation`, `reason` | Return days, Recommendation Acceptance denominator |
| `recommendation_clicked` | at the **destination** of the next-action card | `target` | Recommendation Acceptance numerator |
| `lesson_started` | `POST /api/lessons/[id]/start` | `lesson_id` | Funnel stage 5 |
| `lesson_completed` | `POST /api/lessons/[id]/complete`, first time only | `lesson_id` | Funnel stage 6, activation |
| `chapter_completed` | same route, when the last lesson of a chapter completes | `chapter_id`, `lessons` | Funnel stage 7 — the outcome |
| `practice_started` | `PracticeSession` mount, via `/api/events` | `concept_id` | Practice funnel |
| `practice_completed` | `PracticeSession` finish, via `/api/events` | `concept_id`, counts | Practice completion rate |
| `quiz_started` | `POST /api/quiz/[id]/start` | `chapter_id`, `session_id`, `questions` | Quiz abandonment denominator |
| `quiz_submitted` | `POST /api/quiz/[id]/submit` | score, band | Quiz completion, mastery |
| `hint_requested` | `POST /api/hints`, **before** the AI call | `question_id`, `tier` | Hint ladder usage |
| `ai_question_asked` | `POST /api/tutor`, per learner turn | `lesson_id` | Tutor adoption |
| `tutor_feedback_given` | `POST /api/tutor/feedback` | `helpful` | Tutor quality |
| `streak_extended` | on a completion that turns today into a counted day | `days` | Habit, daily-goal closure |
| `milestone_earned` | on award | `code` | Celebration reach |

`hint_requested` fires *before* the model call, so a hint that times out still
counts as asked. `recommendation_clicked` fires at the destination rather than
on the click, so it counts arrivals rather than intent — a tap that never
finished loading on 4G is not an arrival.

### 3.4 The people around the learner

| Event | Fires | Props | Feeds |
|---|---|---|---|
| `parent_invite_created` | `POST /api/summary-links` or `/api/parent-links`, **created only** | `kind` | Parent funnel stage 1 |
| `parent_linked` | `POST /api/parent-links/claim` | — | Parent funnel stage 2 |
| `parent_summary_sent` | weekly cron | — | Summary open-rate denominator |
| `parent_summary_viewed` | `/s/[token]` render | — | Summary open-rate numerator |
| `mentor_cta_shown` | `MentorCta` mount, via `/api/events` | `trigger` | Mentor demand **denominator** |
| `mentor_request_submitted` | `POST /api/mentor-requests` | `trigger` | Mentor demand numerator |
| `feedback_shown` | `FeedbackPrompt` render, via `/api/events` | — | Feedback response-rate denominator |
| `feedback_submitted` | `POST /api/feedback` | `respondent_role` | Feedback response-rate numerator |

**The four a browser may send** are `practice_started`, `practice_completed`,
`mentor_cta_shown` and `feedback_shown` — the allowlist in
`app/api/events/route.ts`. All four are things only the browser knows happened,
and none is worth faking: two of them are *denominators*, so inflating them
makes the rates read worse.

### 3.5 Deliberately not events

| Not recorded | Why |
|---|---|
| Account deletion | `exit_reasons` is anonymous by construction (migration 0023). An event carrying `student_id` would undo that, and the row would be orphaned a moment later anyway. |
| Dismissing the mentor offer | Declining help is normal, not a failed conversion (`docs/specs/mentor-request.md` §7). `mentor_cta_shown` sizes the ask; it does not grade the learner who said no. |
| Individual practice attempts | Every attempt is already a row in `attempts` with correctness, hints used and timing. An event would duplicate it less well. |
| Signing in | `dashboard_viewed` already stamps a day per learner, so return rate needs no second session marker. |
| Per-step lesson progress | The most invasive grain available, and unreadable at cohort sizes under a hundred. Revisit only with a specific question it answers. |

---

## 4. Anonymous events, and why they are a tally rather than tracking

`welcome_viewed` and `login_viewed` are the top of the funnel. Without them, a
person who opened the link and never signed up is indistinguishable from a
person who never opened it — which is the difference between "the app is
confusing" and "nobody clicked the link", and those call for opposite fixes.

They are written by `trackAnonymous` (service role, `student_id: null`) directly
from the server render. What the row contains:

- a name, a locale, a timestamp

What it does **not** contain, by design:

- no `student_id`, no session id, no cookie, no IP, no user agent, no
  fingerprint, nothing joinable to anything now or later

That is the whole argument. A counter that cannot distinguish two visitors from
one visitor twice does not monitor anybody, which is what makes it acceptable
under DPDP §9(3) where a session-based funnel would not be.

**The cost is real and travels with the number.** These count **screen opens,
not people**. A reload counts twice, and a Next.js prefetch can count without a
human looking at anything. The dashboard labels them "visits, not people" and
never divides a later stage by them to produce a headline percentage.

They are also fenced by their own type — `ANONYMOUS_EVENTS` — so
`trackAnonymous` cannot be called with a learner event, and `track()` cannot be
called with one of these. A test asserts both directions.

---

## 5. Counting rules and known distortions

**Every one of these must be applied in the aggregation layer**, not left to
whoever reads the chart.

| Event | Count as | Because |
|---|---|---|
| `welcome_viewed`, `login_viewed` | raw rows, labelled "visits" | there is no identifier to dedupe by, on purpose |
| `onboarding_started` | distinct `student_id` | a reload of the grade picker emits again |
| `dashboard_viewed` | distinct learner **per minute** | the auth redirect and the page render both land — two rows 354ms apart was the observed case, and prefetch does the same |
| `quiz_started` | distinct `session_id` | it fires on resume as well as first start |
| `parent_invite_created` | distinct `student_id` | the reuse path does not emit at all, so a row means a new invite |
| `mentor_cta_shown` | raw rows | one learner may genuinely be offered help several times |
| everything else | distinct `student_id` for *reach*, raw rows for *volume* | state which one the label means |

**Do not quote a raw Recommendation Acceptance rate.** Until the dashboard
collapses `dashboard_viewed` per learner per minute, the denominator is inflated
and the rate reads low. Reading low is the safe direction for a number that ends
up in a deck, which is why it was left uncorrected — but the fix belongs in the
aggregation layer and this is where it is written down.

### Each funnel stage includes everyone below it

A learner who picked a class necessarily reached the grade picker; one who
finished a lesson necessarily opened it. So each people stage counts its own
learners **union everyone at a later stage**.

This is inference, not invention, and it closes a real hole. The first run of
the funnel against live data showed *"Got an account: 0 → Picked a class: 3"*,
because `onboarding_started` only began existing on 4 August 2026 and everyone
who registered before that has no row for it. Read literally, the funnel grows
downward — which reads as a broken product rather than a gap in the history.

It also makes the funnel monotonic by construction, so any future event that
ships late, fails, or gets dropped degrades into "same as the stage below"
rather than into a number that cannot be true.

**The cost:** a stage can be inferred rather than observed, so it is a *ceiling*
on the drop-off above it, never a floor. Where the two differ the funnel is
generous to the earlier stage — which is the safe direction, because the
drop-off we report comes out smaller than the real one rather than larger.

### The failure mode this section exists for

`track()` fails open. On 4 August 2026 `events.student_id` referenced
`profiles(id)`, so every event emitted between authenticating and picking a
class violated the foreign key and was **discarded in silence** — including
`onboarding_started`, the one event added to measure exactly that window.
Migration `0024` repoints it at `auth.users`.

It was found by counting rows after an end-to-end run, not by a test and not by
an error anyone saw. **Verify new events by counting rows in the database, never
by reading the code that emits them.**

---

## 6. The CEO view

Top of the page. Six numbers, each with a direction and a plain sentence. No
number here needs a paragraph to defend it.

```
DAGAR · METRICS                                      as of 4 Aug, 9:14 pm
                                          [ all time | this week | today ]

  LEARNERS            41          +12 this week
  ACTIVATED           27  (66%)   finished a first lesson
  STILL COMING BACK   14  (34%)   active on two or more days
  LESSONS FINISHED   183          across 3 chapters
  CHAPTERS FINISHED    9          by 7 learners
  ASKED FOR A HUMAN    6          out of 34 times offered
```

| Figure | Definition | Made of |
|---|---|---|
| Learners | people who picked a class | distinct `student_id` on `learner_registered` |
| Activated | share of learners who finished at least one lesson | distinct on `lesson_completed` ÷ learners |
| Still coming back | share active on ≥2 distinct IST dates | distinct dates per learner across all events, ≥2 |
| Lessons finished | total completions | `lesson_completed` rows |
| Chapters finished | total, and how many people | `chapter_completed` rows and distinct learners |
| Asked for a human | requests over offers | `mentor_request_submitted` ÷ `mentor_cta_shown` |

**Charts here: exactly one.** A daily activity line for the last 14 days —
learners active per IST day. It answers "is this alive right now" faster than
any number, and it is the only chart that belongs above the fold.

**Against the PRD targets** (PRD §12), shown as a small table with each figure
next to its target so the gap is visible without arithmetic:

| Metric | Target | Source |
|---|---|---|
| First lesson completion | ≥60% | activated ÷ learners |
| Lesson completion | ≥50% | `lesson_completed` ÷ `lesson_started` |
| AI tutor adoption | ≥50% of active learners | distinct on `ai_question_asked` ÷ active learners |
| Practice completion | ≥60% | `practice_completed` ÷ `practice_started` |
| Recommendation acceptance | ≥30% | `recommendation_clicked` ÷ deduped dashboard views |
| Day-7 retention | ≥25% | active on a day ≥7 days after registering |
| Parent summary open rate | ≥40% | `parent_summary_viewed` ÷ `parent_summary_sent` |

---

## 7. The product-lead view

Everything below the fold. Each section states the question it answers, so a
section that answers nothing gets cut.

### A. The acquisition funnel — *where do we lose people?* — **P0**

Seven stages, each showing count, % of the stage above, and % of the top.

```
  Opened the app          63 visits          ← not people; see §4
  Reached sign-in         48 visits   (76%)
  Got an account          44          (92%)
  Picked a class          41          (93%)
  Opened a lesson         33          (80%)
  Finished a lesson       27          (82%)
  Finished a chapter       7          (26%)
```

**Chart:** horizontal bars, width proportional to the top stage. The step change
is the finding — a stage that falls to 50% is this week's work.

**The one caveat that must be printed on it:** the first two rows are visits and
the rest are people. The boundary is drawn on the chart, and no headline
percentage spans it.

Stages 1→2 and 2→3 have a gap that is **not measurable and never will be**: what
happens on Google's account chooser is off our origin. A drop between "reached
sign-in" and "got an account" is real but its cause is invisible.

### B. Onboarding — *do people who arrive actually start?* — **P0**

- Got an account → picked a class (`onboarding_started` → `learner_registered`)
- Class split: 6 / 7 / 8, from `learner_registered.grade`
- Language at signup: from `learner_registered.locale`
- Time from registering to first `lesson_started` — median

**Chart:** grouped bar, class × language.

### C. Content — *which chapter works, and where do they stop?* — **P0**

Per chapter: learners who opened it, lessons completed, chapter completions, and
**the lesson with the steepest drop-off** — the last lesson many learners
completed with no completion of the next one.

**Chart:** stacked horizontal bar per chapter (completed / started / untouched),
plus a small per-lesson bar strip showing completions by lesson order. The
strip is where "everyone stops at lesson 3" becomes visible.

This is the section that most directly changes what gets authored next.

### D. Learning behaviour — *are they learning, or clicking?* — **P1**

- **Practice accuracy** — `attempts.is_correct` overall, and by concept
- **Hint ladder** — `hint_requested` by `tier`; share of attempts with
  `hints_used > 0`; whether hint use precedes a correct answer
- **Tutor** — `ai_question_asked` per active learner; `tutor_feedback_given`
  helpful share
- **Mastery** — `concept_mastery.is_mastered` per concept, and the band mix
- **Hardest questions** — `attempts` grouped by `question_id`, lowest accuracy
  first, ten rows

**Chart:** accuracy bars per concept, ordered worst first. The hardest-questions
table is a table; ten rows of text beats any chart.

The hardest-questions list is the one output here that feeds content authoring
directly. A question everybody gets wrong is either badly worded or teaching a
gap the lesson did not cover, and both are fixable in a seed file.

### E. Retention and habit — *do they come back?* — **P0**

- Return curve: share of learners active on day 1, 2, 3, 7, 14 after registering
- Distinct active days per learner (distribution, not an average)
- Streaks: current distribution from `streaks.current`, longest reached
- Daily goal closure: `streak_extended` per active day

**Chart:** the return curve as a line; active-days as a small histogram.

Averages hide everything at this cohort size. Six learners on day one and one
learner on day fourteen is a different product from a flat two.

### F. Language — *is Hindi carrying its weight?* — **P0**

Every funnel stage, split EN / HI. Plus `settings_changed` where `locale`
changed, in both directions.

**Chart:** the §A funnel again, as paired bars.

This is the direct test of D16. A Hindi learner dropping out one stage earlier
than an English one is the single most important finding this dashboard can
produce, and it is invisible in any aggregate number.

### G. The parent loop — *does the adult ever arrive?* — **P1**

`parent_invite_created` → `parent_linked` → `parent_summary_sent` →
`parent_summary_viewed`, as a four-stage funnel, plus `summary_links.view_count`
totals.

### H. Demand and feedback signals — *what are they telling us?* — **P0**

- Mentor: `mentor_cta_shown` → `mentor_request_submitted`, broken down by
  `trigger` (which of the three D6 rules fired)
- Feedback: `feedback_shown` → `feedback_submitted`, and the
  `product_feedback` answer mix (`understood`, `would_return`) by
  `respondent_role`
- **Exit reasons** — counts from `exit_reasons`, which has no learner column at
  all, so this section is aggregate by construction

**Chart:** two small funnels and a reason bar chart.

The mentor numerator/denominator pair is what backs the deck's claim that Dagar
*measures* demand for a human rather than pretending to supply one (D8a). Six
requests out of eight offers and six out of two hundred are opposite findings.

### I. Health and cost — *what is this costing, and is it holding up?* — **P1**

From `ai_calls`: total `cost_inr`, cost per active learner against the D11
target, p75 `ttft_ms` for the tutor, and call volume by `kind`.

Not a growth metric. It is here because the institutional pricing floor in
`MARKET_AND_PRICING.md` is derived from it, and a cost per learner that drifts
invalidates a slide.

---

## 8. The glossary

**Required on the page**, not in this file only. Every figure links to its
definition, and the definitions sit in one block at the bottom of the dashboard
so they can be read in one pass.

Each entry says what counts, what does **not** count, and any distortion:

> **Finished a lesson** — got to the end of a lesson and pressed the button that
> marks it done. Re-opening a lesson you already finished does not count again.
>
> **Opened the app** — someone loaded the first screen. This counts **visits,
> not people**: we record nothing that could tell one person from another
> before they have an account, so a reload counts twice. Treat it as a ceiling.
>
> **Still coming back** — was active on at least two different days, Indian
> time. A learner who did everything in one long evening is not counted here,
> deliberately.
>
> **Asked for a human** — tapped the offer of a real teacher. We do not send one
> yet; this measures how much it is wanted (see D8a). The second number is how
> many times the offer was shown.
>
> **Recommendation accepted** — arrived at the lesson or practice the dashboard
> suggested. Counted on arrival, not on tap, so a tap that never loaded does not
> count.

Write these in the same voice as the rest of the product: plain, second person,
no jargon, no event names.

---

## 9. Access and privacy rules for the dashboard

**Fail-closed allowlist.** Admin emails in a server-only environment variable,
checked in a server component. If the variable is missing or empty, **nobody
gets in**. The failure mode must be "locked out", never "wide open" — this page
reads every learner's activity in aggregate.

**Not linked from anywhere in the app.** No nav item, no footer link. Learners
never discover it exists.

**Service role, server-side only.** Nobody reads `events` through the browser
client; the RLS policy is insert-only for learners and there is no read policy
at all. The aggregation runs in a server component or route handler.

**No individual learner, ever.** No names, no email addresses, no per-learner
rows, no drill-down. Counts and distributions only.

This is a product decision, not a technical limit. A page that lets an adult
watch a named child's activity is surveillance whatever we call it, and the
legitimate routes to a struggling individual already exist and are consented:
the mentor request, and the parent summary the learner chose to share. Keeping
the dashboard aggregate also means there is a short, true answer when anyone
asks what it can see.

**No export of anything identifying.** The feedback export already excludes
children's email addresses; the same rule applies here.

---

## 10. What we cannot measure

An honest gap list is a stronger artefact than a silent one. State these on the
page wherever they touch a figure.

| Gap | Why | Could we? |
|---|---|---|
| Whether a person who opened the link is a new person | no identifier before signup, by design | No — and we are not going to |
| What happens on Google's sign-in screen | off our origin | No |
| Why someone abandoned mid-lesson | no per-step events (§3.5) | Yes, but the grain is invasive and the cohort too small to read |
| Anything before 4 Aug 2026 for the eleven new events | they did not exist | No — this data starts now, which is why they shipped before the first cohort |
| Anything lost to the 0024 foreign-key bug | `track()` fails open | No |
| Whether a learner understood, as opposed to answered | `attempts` measures answers; `product_feedback` asks, but self-reported | Partly — quiz mastery band is the closest proxy |

---

## 11. Build order

The dashboard is built in this order, and each step is verifiable on its own.

| # | Step | Priority |
|---|---|---|
| 1 | Fail-closed admin guard (§9) | **P0** |
| 2 | Aggregation layer — one module, all the §5 counting rules applied in it | **P0** |
| 3 | CEO view (§6) + the daily activity line | **P0** |
| 4 | Funnel, onboarding, content, retention, language, signals — §7 A, B, C, E, F, H | **P0** |
| 5 | Glossary block (§8) | **P0** |
| 6 | Learning behaviour, parent loop, health — §7 D, G, I | P1 |

**Charts are inline SVG, no charting library.** The data is tiny, the page is
private, and a dependency that ships 90KB to draw six bars is not a trade worth
making. The viz primitives in `components/learn/viz/` already establish the
pattern.

**Everything is mobile-first**, like the rest of the product. This gets read on
a phone at least as often as on a laptop.

---

## 12. Open decisions

| # | Question | Status |
|---|---|---|
| 1 | Third-party analytics (PostHog) | **Declined for MVP.** No child-tracking third party. Revisit only as an aggregate server-side push with no identifiers, and only after the parental-consent flow ships. Needs a `DECISIONS.md` entry so the deck stops implying it is used. |
| 2 | Date-range picker vs fixed windows | Proposed: three fixed windows (all time / this week / today). A picker is a P1 nicety. |
| 3 | `mentor_cta_shown` | Shipped, flagged. It is the denominator for a claim in the deck, but it sits close to the spec rule against recording dismissal (§3.5). Reversible in one line if the CEO would rather not have it. |
| 4 | Alerting | Out of scope. At this cohort size, looking at the page is the alert. |

---

## Referenced

- `docs/DATA_MODEL.md` — schema, RLS shape, the canonical event list
- `docs/DECISIONS.md` — D5 mastery, D6/D8a mentor, D11 targets, D16 Hindi, D17 habit
- `docs/PRD.md` §12 — success criteria and targets
- `docs/MARKET_AND_PRICING.md` — the cost-per-learner floor §7I feeds
- `lib/analytics/track.ts` — `EVENT_NAMES`, `ANONYMOUS_EVENTS`, the PII scrub
- `tests/unit/events.test.ts` — asserts every catalogued event is actually emitted
