# Saathi — Build Decisions (PRD Addendum)

These are the implementation decisions the PRD v1.0 left open. This file is the
source of truth when the PRD is silent or ambiguous. Update it, don't argue with it.

Decided: 2026-07-29 · Stage: Buildathon MVP · Timeline: **4 days (30 Jul – 2 Aug 2026)**
Deliverables due Sun 2 Aug 11pm: deployed app **and** deck.

---

## D1 — Curriculum scope & content source

**Decision:** Classes 6, 7 and 8 — **one chapter each**, three chapters total.
Lesson content is **pre-authored** and seeded into Supabase. The AI Tutor is
grounded in that seeded text and never invents lesson content.

| Class | Chapter | Concepts | Micro-lessons |
|---|---|---|---|
| 6 | Fractions | 4 | 4–5 |
| 7 | Integers | 4 | 4–5 |
| 8 | Solving Linear Equations | 4 | 4–5 |

Rationale: shows the full grade range in the UI (a demo asset) at the same
authoring cost as depth in one grade. Grounded content removes math-hallucination
risk during a live demo.

**Non-goal:** full NCERT coverage. The schema supports it; the seed does not.

### NCERT edition mapping (verified online 2026-07-29)

NCERT is mid-rollout of **Ganita Prakash**, which replaces the older textbooks and
**renumbers or dissolves the chapters we target**. Both editions are in circulation
right now, and underserved government schools — Saathi's actual audience — are the
most likely to still be on old stock, because new textbook distribution reaches them
last.

| Class | Ganita Prakash (new) | Old NCERT | Same content? |
|---|---|---|---|
| 6 | **Ch 7 — Fractions** | Ch 7 — Fractions | ✅ identical placement |
| 7 | **Part 2, Ch 2 — Operations with Integers** | Ch 1 — Integers | ✅ renumbered only |
| 8 | **Part 2, Ch 6 — Algebra Play** | Ch 2 — Linear Equations in One Variable | ⚠️ **no dedicated chapter any more** — solving linear equations now sits inside a broader algebra chapter |

**Decision: anchor content to the _concept_, never to a chapter number.** The
concepts — equivalent fractions, integer operations, solving linear equations — are
identical across both editions. Chapter numbers are not.

`chapters.ncert_ref` carries both citations so the app can state its source
correctly whichever book a learner owns, and so a demo question about curriculum
alignment has a confident answer.

Class 8's title changes from "Linear Equations in One Variable" (an old-edition
chapter name) to **"Solving Linear Equations"** — a concept name that is true in
both editions.

## D2 — Accounts & parent linking

**Decision:** Student signs up with Supabase Auth. Student profile carries the
grade. App generates a **6-character link code**; the parent enters it (or opens
the link) to get a **read-only** parent view of that student.

- One `profiles` row per user, `role` is `student` or `parent`.
- `parent_links` is the join, and the **only** RLS boundary that matters.
- Parents never write to learner data.
- Minors: collect display name + grade only. No DOB, no address, no photo.

### Login method

**Google Sign-In (Supabase OAuth) as primary, email + password as fallback.**

| Method | MVP | Reasoning |
|---|---|---|
| **Google Sign-In** | ✅ Primary | On a shared Android phone the Google account is already signed in — one tap, no password a 12-year-old can forget, no SMS cost |
| **Email + password** | ✅ Fallback | For learners without a usable Google account |
| **Phone OTP** | ⛔ Phase 2 | **India DLT registration** — same TRAI blocker as D4. Needs a registered entity plus per-template approval. Not achievable in this build |
| Magic link | ✖ | Works, but needs inbox access — more friction than Google on Android |

Phone OTP is the natural long-term primary for India and should replace Google as
the default once DLT clears. Build the auth screen so adding it is a new button,
not a rewrite.

Note on ages: learners are 11–14, so some are under 13 and will be on a Family
Link-managed Google account. Those accounts sign in normally. On a shared phone the
Google account may belong to the parent — acceptable, and it pairs naturally with
the parent link code.

## D15 — Distribution: PWA now, Play Store later

**Saathi is a mobile-first Progressive Web App, not a native APK.**

Installs to the Android home screen via Chrome "Add to Home Screen" — own icon,
fullscreen, app-like. Judges open a URL rather than sideloading an APK.

Why not Play Store for the buildathon:

- Personal Play developer accounts created after Nov 2023 must run a **closed test
  with 12+ testers opted in continuously for 14 days** before they can apply for
  production access. Organisation accounts are exempt but need business
  verification. Either way: longer than the build.
- $25 fee plus identity verification, then app review on top.
- Native Android would discard the entire Next.js/Vercel plan for a different stack.

**Path to the store:** wrap the same PWA in a **Trusted Web Activity** (Bubblewrap)
post-buildathon. Real Play Store listing, no rewrite. A PWA also works on iOS, so
the platform question does not need answering now.

MVP requirements: `manifest.json` with icons and `display: standalone`, a service
worker for the app shell, and an install prompt. Full offline learning stays Phase 3.

## D16 — Hindi language support **is in MVP**

**Decision:** Saathi ships **bilingual: English + Hindi (Devanagari)** in the
Buildathon MVP. Not Phase 2.

Rationale: Saathi's learners are disproportionately in Hindi-medium government
schools. An English-only interface is not a missing feature for them — it is a
wall at the front door. Adaptive personalisation is worth nothing to a learner who
cannot read the lesson. Language access outranks sophistication for this audience.

### What "bilingual" covers

| Surface | MVP | Notes |
|---|---|---|
| UI strings (nav, buttons, feedback, empty states) | ✅ Full Hindi | ~150 strings |
| AI Tutor responses | ✅ Full Hindi | Responds in the learner's chosen language |
| Micro-lesson bodies | ✅ Full Hindi, **all three classes** | Scope raised 2026-07-29 — see below |
| Question stems & solutions | ✅ Full Hindi, all three classes | |
| Parent WhatsApp summary | ✅ Hindi | Parents need it **more** than learners |
| **Answer keys** | ⛔ **Never translated** | Language-independent by design — see below |

### Scope raised to all three classes (2026-07-29)

D16 originally scoped Hindi content to Classes 6 and 7, with Class 8 "if time". That
was written against a **3-day** plan, before we knew what translation actually cost.
Both premises changed: the deadline is Sun 2 Aug 11pm, and translation is a Haiku
call worth a couple of rupees.

Measured cost of adding Class 8: **~0 extra build time** (the same authoring prompt
covers three chapters instead of two) and **~20 minutes** of additional human
read-through. Against that, leaving it out meant a Class 8 learner choosing हिंदी got
a Hindi app wrapped around English lessons — the exact barrier D16 exists to remove,
reintroduced for a third of learners.

Class 8 Hindi is therefore **in scope** and is **off the contingency cut list**.

### The load-bearing rule

**`answer_value` is language-independent and is never translated.** `1/2` is `1/2`
in every language. Only `body_md`, `stem_md` and `solution_md` have Hindi variants.

This means Hindi **never touches `lib/learning/grading.ts`**. A translation error
can produce a confusing question; it can never mark a correct learner wrong. That
property is what makes this affordable — do not break it by localising answers.

### Storage

A single `i18n` **jsonb** column on `lessons`, `questions`, `chapters` and
`concepts`, holding `{"hi": {"title": "...", "body_md": "..."}}`. English stays in
the base columns as the fallback.

Chosen over per-language columns (doesn't scale past two languages) and a
translations table (a join on every read, for a 4-day build). Adding Marathi or
Tamil in Phase 2 is a new jsonb key, not a migration.

Resolution: `t(row, 'body_md', locale)` → `row.i18n?.[locale]?.body_md ?? row.body_md`.
**Always fall back to English** — a missing translation must render English, never
an empty screen.

### Learner locale

`profiles.locale` (`en` | `hi`, default `en`).

**Learner:** the language picker is the **first** onboarding screen, before grade
selection — a learner who cannot read English must not have to get through an
English screen to reach it. Switchable any time from **Settings**.

**Parent:** on claiming the link code, the parent's locale **defaults to the
learner's** and is switchable from the parent view. Parent and learner locales are
independent after that — a parent may read Hindi while the child prefers English.
The weekly WhatsApp summary uses the *parent's* locale.

**Never infer from device locale alone.** A shared phone's language is usually the
parent's, not the learner's. Device locale may pre-select the picker default; it
never skips the picker.

**Where the locale is read from at render time (added 2026-07-30, Day 0 prompt 5).**
`profiles.locale` is the durable record, but the value a page actually renders with
comes from the `saathi_locale` **cookie**. Two reasons, both structural:

1. The picker runs before a profile exists, so on that screen there is nothing else
   to read.
2. Saathi has **no `[locale]` route segment** — `/learn`, not `/hi/learn` — so the URL
   carries no locale either, and a Server Component cannot read `localStorage`.
   Without a cookie the first paint is English and flips to Hindi on hydration.

The two are synchronised in `i18n/actions.ts`: the Settings toggle writes both, profile
creation writes the profile from the cookie, and sign-in on a fresh device rewrites the
cookie from the profile. Full table in `docs/specs/i18n.md` §3.

### Authoring workflow

Author in English, translate with Claude (Haiku — near-zero cost), then **verify by
reading**. Review is far faster than dual authoring.

**Register: match the learner's NCERT Hindi maths textbook** for lesson bodies,
question stems and solutions — it is already written for their age, and matching it
means the app and the textbook reinforce each other. Conversational Hindi applies
only to UI chrome, tutor dialogue and feedback, where no textbook equivalent exists.
Full guidance in `docs/HINDI_STYLE.md` — load it before any Hindi work.

Mechanical checks: NCERT maths terms (भिन्न, पूर्णांक, समीकरण), numerals stay Arabic
(`1/2`, never `१/२`), KaTeX blocks byte-identical.

**Staleness is the ongoing risk** — editing an English `body_md` silently leaves the
Hindi stale, and nothing catches it. Change both in the same commit.

### Deliberately excluded from MVP

Hinglish (Roman-script Hindi) as a third option, other regional languages,
voice/audio, and RTL support. Phase 2 adds languages; the jsonb structure already
allows it.

### Phase 2 — author Hindi natively, don't translate into it

**Agreed post-MVP (2026-07-29):** Hindi lessons get **written in Hindi**, not
translated from English.

Why this is more than a quality upgrade: translation, however careful, carries
English sentence structure and English examples underneath. For a learner whose
every other textbook is in Hindi, that reads as slightly foreign — and Hindi-medium
learners are not a secondary audience for Saathi, they are the core one.

**The architectural consequence, which is the part worth knowing now:**

> The MVP model makes English **canonical** — English lives in the base columns,
> Hindi is an overlay in `i18n` jsonb, and a missing Hindi key falls back to English.
> That structure encodes *"English is the real version, Hindi is a copy of it."*

That is the correct trade for a 4-day build and it is genuinely cheap. But native
Hindi authoring breaks the assumption: a natively-written Hindi lesson has no English
original to fall back to, and is not a variant of anything.

Phase 2 therefore needs a **content model where no language is the original** — a
per-locale content row with its own lifecycle, rather than base columns plus an
overlay. Do not try to bend the jsonb into it.

Two MVP properties must survive the change:
- **`answer_value` stays language-independent.** It is what keeps translation, and
  now authoring, off the grading path entirely.
- **Something must always render.** Fallback exists because a blank screen is worse
  than the wrong language. Under a symmetric model this becomes an explicit fallback
  *chain*, not an English-privileged one — but it does not disappear.

**Migration cost, corrected:** moving to the symmetric model later is **small** —
roughly 15 lessons and 72 questions, one script, about an hour. An earlier draft of
this section implied it was expensive to retrofit. It is not, and that should not be
used as an argument for pulling the work forward.

### Considered for MVP and rejected (2026-07-29)

Native Hindi authoring **inside the buildathon MVP** was considered explicitly and
turned down. Recorded because the question will resurface mid-build:

| Cost | Why it bites in a 4-day build |
|---|---|
| **Review burden roughly doubles, and the stakes rise** | Reviewing a translation means checking *language* against a known-good English original. Native Hindi has no twin, so the **maths** must be verified independently too. A wrong worked example in a Hindi lesson has nothing to catch it. ~1 hour becomes 2+. |
| **Graceful degradation is lost, exactly where it is needed** | The cut list already has "Hindi content for Class 8" as item 3. Today that cut renders English and looks deliberate. With no canonical language, a cut chapter has nothing to fall back to — **a cut we have already planned for stops being survivable.** |
| **Every content read becomes a join** | 1–2 hours across the build, and more places to get a query wrong on Day 2. |

Against that, the gain is small **at MVP scale**: at 150–300 words per lesson, a
translation written to NCERT-textbook register and a natively authored lesson are
hard to tell apart. Native authoring pays off in longer content and at volume —
neither of which the MVP has.

**Decision: MVP keeps translate-then-review. Native authoring is Phase 2.**

Two things would reopen this:

1. **Demo judges are Hindi-medium educators** who will read the content closely and
   assess it as content. Then perceived authenticity outweighs the build cost.
2. **A single-chapter pilot** — author Class 6 Fractions natively in Hindi, leave
   Classes 7 and 8 translated. Bounded cost, real learning about the review burden,
   fallback still intact everywhere else, and no schema change needed. This is the
   middle path if the work needs to start before Phase 2.

## D3 — Question bank & grading

**Decision:** Questions are **authored once and seeded**, tagged with concept and
difficulty (1–3), with a canonical answer. AI generates **hints and explanations
only** — never the answer key.

Grading is deterministic, in code, per `answer_type`:

| answer_type | Grading rule |
|---|---|
| `mcq` | Exact match on choice id |
| `integer` | Parse to int, exact match |
| `fraction` | Normalise to lowest terms, compare numerator/denominator. `2/4`, `1/2` and `0.5` all match `1/2` |
| `decimal` | Compare within tolerance `1e-6` |
| `expression` | Normalise whitespace + operator order for the small set used in Class 8 linear equations; falls back to string compare |

Adaptivity = **selecting from the bank by difficulty**, not generating questions.
Rule: 2 correct in a row → step difficulty up. 2 wrong in a row → step down and
serve a worked example.

## D4 — Parent summaries: WhatsApp

**Decision:** Channel-agnostic notification layer. One interface:

```ts
sendParentSummary(link: ParentLink, summary: WeeklySummary): Promise<DeliveryResult>
```

Adapters, in order of MVP readiness:

| Channel | MVP status | Blocker |
|---|---|---|
| **In-app** (`/parent`) | ✅ Always works | none |
| **WhatsApp** (Twilio Sandbox) | ⚠️ **Demo only — cannot carry a weekly cadence.** See below | 72h session expiry + no custom templates |
| **SMS** (Twilio) | ⛔ Stub only | **India DLT registration** — TRAI mandates entity + sender ID + per-template registration for all A2P SMS to Indian numbers. Multi-day, needs a registered business. Not achievable in this build. |
| WhatsApp Cloud API (Meta) | Post-buildathon | Meta business verification |

Why WhatsApp over SMS is the *right* call, not just the fast one: WhatsApp
penetration among Indian parents in this demographic substantially exceeds email,
and messages are free over data where SMS bills per message. It fits the underserved
parent better than either alternative.

The SMS adapter ships as a working, unregistered stub so the channel is one config
change away once DLT clears. Say this explicitly in the demo — it's an architecture
strength, not a gap.

### Amended 1 Aug 2026 — the recipient comes from the LEARNER, not a parent account

D4 originally hung delivery off `parent_links.whatsapp_e164`, which meant the
weekly summary could only reach an adult who had **created an account and
redeemed a 6-character code**. Building that flow showed the friction is not
worth it for the common case:

- the child is usually on the parent's phone, so that parent already sees more by
  opening the app than a second account would show them
- the person who actually reads a summary here is often the most literate person
  in the household — frequently an older sibling — or a tutor looking at it
  beside a parent, and none of them will register
- `/parent` shows **one** child, so the account path's best argument (a tutor with
  several learners) is not implemented and does not justify it

**So: the learner enters the recipient's WhatsApp number in Settings.** No parent
account is required for delivery, and the message carries the `/s/[token]` link,
which also needs no account. The account path stays for anyone who wants a
permanent signed-in view, and is **first on the cut list**.

Consent is not skipped by this — it is relocated to where it actually belongs.
The Twilio sandbox requires the recipient to send a join code from their own
WhatsApp before anything can be delivered to them, so **the adult opts in from
their own phone**, whatever a learner typed. A number entered by a child is an
intention, not a permission; the join step is the permission.

The number is the adult's PII: never in `events`, never in a prompt, removable by
the learner at any time, and used for delivery only.

**Known limitation, accepted 1 Aug 2026.** The weekly cron iterates `summary_links`
only, so a parent who took the **account** path receives no weekly message. They
are not missing the content — `/parent` shows the same summary, live, whenever
they sign in — only the nudge. Extending the cron to `parent_links` is half an
hour and was declined deliberately: the account path is first on the cut list,
and spending build time on the path we agreed not to invest in is how a cut list
stops meaning anything. Revisit only if the account path survives.

### The sandbox cannot deliver a weekly summary at all (verified 2026-07-29)

Correcting an earlier, softer framing that called the sandbox merely "not production
ready" and blamed the `join` step. Twilio's own limits are harder than that:

| Constraint | Consequence |
|---|---|
| Participants | **No limit** — capacity was never the issue |
| Volume | Unlimited, 1 msg / 3 s — trivial for a 20-family pilot |
| **Session expires 3 days after joining** | A parent who joins Monday is disconnected by Thursday. A Sunday summary never arrives, and nothing can prompt them to rejoin |
| **Custom templates not permitted** | Only Twilio's three fixed test templates. Outside the 24h reply window you need a template, and yours cannot exist |

**Either blocker alone is fatal; together they make a weekly cadence impossible.**

The sandbox works in the *demo* precisely because the parent joins minutes before
the send — inside both windows. At a weekly cadence it does not degrade, it never
fires. Do not plan a pilot around it.

### So what carries the pilot

**The in-app `/parent` view** (slice 3.1) is the real channel. It has no gates, no
expiry, no approval, and it already holds the full unconstrained summary.

To get the link to a parent, **the learner shares it from their own WhatsApp** —
person-to-person, not the Business API. No join code, no template, no verification,
no session window. For a pilot of this size it works today, and it arrives from the
child rather than from an unknown foreign number, which is the better introduction
anyway.

WhatsApp *Business* delivery stays Phase 2, gated on Meta verification.

### Phase 2 — move off the Twilio Sandbox

**Agreed post-MVP (2026-07-29):** WhatsApp becomes a real channel, not a demo one.

The sandbox has one blocking flaw for actual users: **every parent must first send
`join <code>` to a Twilio number.** That is fine for a demo where you brief the
person beforehand, and impossible at any real scale — an underserved parent will not
complete a setup step they were never told about.

| Step | Unblocks |
|---|---|
| **WhatsApp Cloud API** (Meta business verification) | No `join` step. Parents receive messages because they were linked, full stop |
| **Message templates** approved by Meta | Legally sendable outside the 24-hour session window — a weekly summary *is* outside it |
| **DLT registration** (TRAI) | The SMS adapter, and phone-OTP login (D2), both of which are blocked today |

DLT is worth starting early: it is multi-day, needs a registered business entity, and
it gates two separate features. Nothing in the code changes when it clears — the
adapter is already written (D4). That is the point of the channel-agnostic layer.

#### The summary generator changes shape, not just the adapter

WhatsApp permits **free-form** messages only within 24 hours of the *user* messaging
you. A weekly summary is unprompted, so it always falls outside that window and must
be a **template approved by Meta in advance** — fixed wording with variable slots:

```
नमस्ते {{1}}, इस हफ़्ते {{2}} ने {{3}} पाठ पूरे किए और {{4}} हासिल किया। {{5}}
```

Slice 3.3 generates the summary as **free AI prose** (Haiku). That is correct for the
MVP — it works in the sandbox and inside the session window — but it does not survive
production. There, the generator's job changes from *writing a paragraph* to *filling
fields*: name, lesson count, milestone earned, tracking link, and at most one short
generated line inside a slot.

So Phase 2 is **not** a credentials swap alone. Budget for:

- Rewriting `lib/ai/summaries.ts` to emit structured fields, not prose
- Getting templates approved by Meta **in both English and Hindi** — each locale is a
  separate submission, and approval is not instant
- Keeping the in-app `/parent` view as the place where the full, unconstrained
  summary still lives. Template limits apply to WhatsApp, not to your own screen.

The channel-agnostic interface still earns its keep — `sendParentSummary()` does not
change. What changes is what `WeeklySummary` contains.

Metric correction: PRD §11 "Weekly summary open rate" is not measurable over
WhatsApp sandbox. Replace with **Parent Summary Engagement** = (summary delivered
AND parent opened `/parent` within 72h) / summaries delivered. The summary
message carries a deep link with a tracking token.

## D5 — Mastery (PRD uses the word, never defines it)

- **Concept mastery score** = correct ÷ attempted over the learner's **last 5
  attempts** on that concept.
- A concept is **Mastered** at score ≥ 0.8 with ≥ 3 attempts.
- **Chapter mastery** = % of the chapter's concepts that are Mastered.
- **Quiz bands:** < 50% `Needs Revision` · 50–79% `Developing` · ≥ 80% `Mastered`.

## D6 — Struggle detection (triggers mentor escalation)

Surface the "Talk to a mentor" CTA when **any** of:

1. 3 consecutive incorrect attempts on the same concept, or
2. 2 attempts on the same concept where all hints were exhausted, or
3. ≥ 4 AI Tutor turns on one lesson with no practice attempt started.

The CTA is a suggestion, never a modal or a block. The learner can always dismiss it.

## D7 — Streaks

- A day counts if the learner **completes ≥ 1 micro-lesson OR ≥ 5 practice questions**.
- Day boundary: **Asia/Kolkata**, stored as a date, not a timestamp.
- **One grace day per rolling 7 days** — a single missed day does not reset the streak.
- Streak is recomputed server-side on write. Never trust a client-supplied streak.

## D7b — Milestones & achievements

PRD §9 requires the progress screen to show "achievements and milestones", and §5
gives parents "celebrate milestones" as a value proposition. Streaks alone don't
cover this — a streak is a *state*, a milestone is a *moment*.

Milestones are **automatic and event-derived**. No badge editor, no config UI.
Awarded server-side on the same write that triggers them, and idempotent —
unique(`student_id`, `code`) means it can never double-award.

| Code | Earned when | Why it's here |
|---|---|---|
| `first_lesson` | First lesson completed | Activation — the PRD's ≥60% first-lesson target |
| `first_practice` | First practice set completed | Reinforces the lesson→practice habit |
| `streak_3` | 3-day streak | First habit checkpoint |
| `streak_7` | 7-day streak | Maps to the Day-7 retention target |
| `concept_mastered` | Any concept reaches Mastered (D5) | Learning outcome, not just activity |
| `chapter_complete` | All lessons in a chapter completed | Journey completion |
| `chapter_mastered` | All concepts in a chapter Mastered | The strongest signal available |

**Surfacing:**
- Toast on earn — celebratory, honours `prefers-reduced-motion` (D10)
- **One moment, ranked, never a stack** (added 2 Aug 2026). A milestone is *rare* —
  seven codes, most earned once ever — so on its own it left every ordinary
  completion ending in a line of small grey text. The second moment is **the day
  becoming counted**, which is the goal ring closing and the streak moving; by D7
  and D17 those are the same event, so they are reported once, together. The
  routes return a `dayCounted` flag they were already computing internally and
  discarding. `lib/learning/celebration.ts` ranks: milestone > day > silence.
  A milestone never shows alongside the day — on the day one is earned the day was
  almost always counted by the same action, so both would report one event twice.
- **Silence is the third outcome, deliberately.** A second lesson on a day already
  counted celebrates nothing. Rewarding it would be XP by another name, which D17
  rejects: a second scoring system competing with concept mastery, which is the
  score that means something.
- Listed on the progress screen, earned and unearned both visible so there's a next goal
- **Included in the parent WhatsApp summary** — this is what actually delivers the
  §5 "celebrate milestones" job. A milestone is the single most worthwhile thing to
  put in a parent message.

**Deliberately excluded from MVP:** points, levels, leaderboards, and anything
competitive between learners. The PRD's audience is learners who are already behind;
ranking them against peers works against the product's stated purpose.

Emits `milestone_earned` with the code.

## D17 — Habit mechanics: what we take from Duolingo, and what we don't

Duolingo is the reference for habit design. But its audience is a **voluntary adult
hobbyist** who can quit with no consequence. Saathi's is a **12-year-old who is
already behind in a subject they cannot opt out of.** Several Duolingo mechanics
invert when you change that premise.

### Take

| Mechanic | Why it transfers |
|---|---|
| **Prominent streak** with flame, always visible in the header | Consistency is the PRD's stated challenge (H6) |
| **Grace day** (Duolingo's streak freeze) | Already D7. Prevents the one-missed-day rage-quit |
| **Daily goal ring** — "1 lesson today", small and closable | The single strongest daily-return mechanic; cheap to build |
| **Visible finish line inside a lesson** — progress dots | A learner who can see the end keeps going |
| **Immediate feedback on every answer** | Already D3; make it feel instant and warm |
| **Celebration moments** at milestones | Already D7b |
| **Journey/path layout** for chapters, not a flat list | Progress you can *see* beats a percentage |

### Deliberately reject

| Mechanic | Why it breaks Saathi |
|---|---|
| **Leagues / leaderboards** | Ranks learners against each other. Saathi's learners are selected for being behind — ranking them is demotivating for exactly the people we serve. Already design rule 12. |
| **Hearts / lives** | Makes mistakes scarce and stops the lesson. A learner who is getting things wrong is the learner who needs *more* practice, not a locked door. Directly contradicts amber-not-red. |
| **Guilt-based notifications** | The passive-aggressive-owl pattern. Wrong for a child, and worse on a shared phone where a parent sees it. Notifications, when added, encourage — they never shame. **See D17b: encouraging reminders are in scope; countdowns are not.** |
| **XP / points / levels** | Adds a second scoring system competing with concept mastery, which is the score that actually means something. |

## D17b — Reminder notifications **are** in scope, as encouragement

**Decision (2026-07-30):** Saathi sends a **daily reminder notification**, opt-in,
worded as an invitation. This does not contradict D17 — D17 rejects *guilt*
notifications and says explicitly that notifications, when added, encourage.

**Why it earns its place:** learners and parents genuinely forget, and they forget
most in the **first weeks**, before the habit exists. Pull-only mechanics (the
streak flame, the goal ring) work on someone who already opened the app. A learner
who forgets never sees them. That is a real gap, not a motivational failure.

### The line between a reminder and a guilt trip

| Ship | Never ship |
|---|---|
| "Ready for today's lesson?" | "Your streak dies in 3 hours" |
| Timed to a **routine** — after school | Timed to a **deadline** — midnight |
| One a day, maximum | Escalating nags |
| Silent if the goal is already done | Fires regardless |
| Safe for a parent to read over a shoulder | Anything that reads as a reproach |

**Shared phones make this a hard constraint, not a preference.** The notification
lands on whoever is holding the handset, often a parent. Copy that shames the
learner is delivered to the person whose opinion they care about most.

### Design specifics

- **Opt-in, asked at the right moment** — after a first completed lesson, never on
  first load. A permission prompt before any value is delivered is how an app gets
  permission denied permanently.
- **Skipped when the daily goal is already met** (D17). An app that reminds you to
  do something you have done is an app you stop trusting.
- **Every day, indefinitely — no tapering.** Revised 2026-07-30 on the product
  owner's call, and it is the right one: a learner in week 3 forgets exactly as
  easily as a learner in week 1, and an app that quietly stops reminding you is an
  app that decides on your behalf that you no longer need help.

  Fatigue is controlled by the **skip rule, not by frequency**: on any day the goal
  is already met, nothing is sent. So an engaged learner naturally receives fewer
  notifications, without the schedule ever having to guess whether they still need
  one.
- **In the learner's locale**, via the same dictionary as the UI.
- No countdown, no streak-loss language, ever.

### Why 19:00 IST

The product owner's instinct was to fire it when four or five hours of the day
remain. That is right, and 19:00 IST delivers it **without** the countdown framing:

- after school and after the evening meal is under way — when homework actually happens
- roughly five hours before the day rolls over, so there is real time to act
- not so late that it reaches a child at bedtime

So the *timing* carries the urgency and the *copy* stays an invitation. The learner
gets a nudge with the evening still ahead of them; they are never told a clock is
running. D7's grace day already means one missed day does not break a streak, so
there is nothing genuinely expiring to warn about.

**One notification per day, not two.** A "last chance" second message is the exact
point at which a reminder becomes a nag.

### Channel

**Web Push through the service worker we already ship** (D15) — no new platform.

| Platform | Works |
|---|---|
| Android Chrome | ✅ directly |
| Desktop Chrome | ✅ |
| **iOS Safari** | ⚠️ **only once the PWA is installed to the home screen**, iOS 16.4+ |

The iOS limitation is real and must be said plainly in the demo rather than
discovered by a judge on an iPhone.

SMS remains DLT-blocked and WhatsApp sandbox cannot carry a scheduled cadence
(D4), so Web Push is the only learner channel available in this build.

### The line

**Motivate by progress, never by fear of loss or comparison.** Duolingo leans on
loss aversion (your streak! your league!) because its user can walk away. Saathi's
learner already feels behind — adding manufactured anxiety works against the
product's whole reason for existing.

A broken streak reads "आज से नया शुरू करते हैं" / "Start fresh today", never
"You lost your 12-day streak."

### MVP scope

In: streak, grace day, daily goal ring, in-lesson progress, milestone toasts,
journey layout. Out: everything in the reject table, plus mascot and sound design
(Phase 2 — both are real habit levers, neither is a 4-day build).

## D8 — Mentor requests

MVP captures the request with full learner context (concept, recent attempts,
tutor transcript) into `mentor_requests` and confirms to the learner. There is
**no mentor-side UI in MVP** — requests are reviewed manually. Status enum:
`open → acknowledged → resolved`.

## D9 — Stack

| Layer | Choice |
|---|---|
| App | Next.js App Router (TypeScript), installable **PWA**, mobile-first — not a native APK (D15) |
| Hosting | Vercel (web URL; Play Store via TWA post-buildathon) |
| DB / Auth / RLS | Supabase Postgres |
| AI — tutor & hints | Claude Sonnet 5 (`claude-sonnet-5`) |
| AI — summaries, batch | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Math rendering | KaTeX |
| Messaging | Twilio WhatsApp Sandbox (adapter pattern) |
| Analytics | Supabase `events` table (source of truth) + PostHog free tier (exploration) |
| Cron | Vercel Cron → weekly parent summary |
| Language | **English + Hindi (Devanagari)** — see D16 |

## D10 — Accessibility baseline **is in MVP**

The PRD defers all accessibility to Phase 3. That contradicts the product's own
vision statement and is cheap to do now, expensive to retrofit. In MVP:

- Semantic HTML and correct landmark structure
- WCAG 2.1 **AA** colour contrast throughout
- Full keyboard navigation with visible focus states
- Every interactive element has an accessible name
- `prefers-reduced-motion` respected on all animation
- Minimum 44×44px touch targets
- Text reflows at 200% zoom without horizontal scroll

Still deferred to Phase 3: screen-reader-optimised learning modes, sign-language
support, voice-first interaction, offline learning.

## D11 — Non-functional targets

| Concern | Target |
|---|---|
| AI Tutor first token | < 2s p75 |
| Page interactive | < 3s p75 on 4G |
| AI cost per active learner | **₹4.2/week intro pricing · ₹6.4/week standard** (verified 2026-07-28: Sonnet 5 $3/$15 per Mtok, cache reads 0.1×, ~15 tutor exchanges/week). Cap at ₹7/week. |
| Tutor safety | System prompt is curriculum-scoped; refuse off-topic; never request personal info from a minor |
| Data retention | Tutor transcripts 90 days, then aggregate-only |
| Secrets | Server-side only. No `NEXT_PUBLIC_` on any AI or Twilio key. Ever. |
| Tutor rate limit | 30 messages/hour/learner, server-side. Normal usage cannot overspend; a retry loop can. |
| **Daily spend ceiling** | **₹150/day across all learners.** Before each AI call, sum `cost_inr` from `ai_calls` for today; over the ceiling → skip the call and return the tutor-unavailable state. |

### Two layers of cost protection (2026-07-30)

| Layer | Protects | Fails |
|---|---|---|
| **Anthropic prepaid credits, auto-reload OFF** | Your card. Spend cannot exceed what you loaded | **Hard** — balance hits zero, every AI call dies with no warning |
| **App-side daily ceiling (above)** | The demo | **Soft** — the tutor degrades to its existing unavailable state, lessons and practice keep working, and `/admin/metrics` shows why |

**Claude Pro (claude.ai) gives zero API credits** — the two are separate products with
separate billing. An API key never draws on a claude.ai subscription.

The app-side ceiling is nearly free because `ai_calls.cost_inr` is already written on
every call for observability. It reuses the tutor-unavailable path from
`docs/specs/ai-tutor.md`, so there is no new UI state to design.

**Caching gotcha:** Sonnet 5 will not cache a prefix under **1024 tokens** — it fails
silently, with no error and no discount. Keep system prompt + lesson grounding above
that, and verify `usage.cache_read_input_tokens > 0` once running. Caching is worth
~40% of tutor cost (₹0.47 → ₹0.28 per exchange).

**Intro pricing ends 2026-08-31** — Sonnet 5 is $2/$10 per Mtok until then, $3/$15 after.

## D12 — Canonical hypotheses (PRD §3 and §12 conflict — this list wins)

Applied to the PRD 2026-07-28: §3 and §12 now carry this identical list, and §1
keeps prose success criteria with **no H-numbers** (a third numbered copy is how
§12 drifted originally).

| ID | Hypothesis | Success indicator | Capability validated |
|---|---|---|---|
| H1 | Structured chapter-based learning improves learning consistency | Lesson completion ≥ 50% | Curriculum Dashboard, Micro Lessons |
| H2 | Curriculum-aware AI explanations improve conceptual understanding | AI Tutor adoption ≥ 50% of active learners | AI Tutor |
| H3 | Practice immediately after a lesson improves mastery | Practice completion ≥ 60%; higher quiz scores among practice-completers | Guided Practice, Chapter Quiz |
| H4 | Personalised recommendations increase lesson completion | Recommendation acceptance ≥ 30% | Learning Intelligence Engine |
| H5 | Progress tracking and streaks improve learner retention | Day-7 retention ≥ 25% | Progress & Streaks |
| H6 | Parent engagement improves learner consistency | Parent summary engagement ≥ 40% | Parent Companion |
| H7 | Learners who remain stuck will request human mentor support | Mentor requests cluster on identifiable concepts | Human Mentor Request |

Every Must-Have and Should-Have in PRD §10 maps to exactly one hypothesis, and
every indicator is a number already present in §12's success-criteria table.

Renumbering note — the old §3 IDs changed, so any external reference needs updating:
old H3→H3, old H4→**H6**, old H5→**H7**, old H6→**H5**.

## D14 — Commercial model

**MVP is free.** No pricing experiments until H1–H7 have data; charging now would
contaminate the activation and retention metrics that decide whether the product
works. Free is a declared stage, not a missing model.

Post-MVP: learners never pay for the core learning loop. Institutions (NGO, CSR,
government) pay per learner for reach; families pay only for depth via Saathi Plus.
Institutional pricing floor is **₹300/learner/year** — the D11 cost target for a
fully active learner. Full tiers, unit economics and market sizing in
`MARKET_AND_PRICING.md`.

## D18 — Lessons are steps, not prose (2026-08-02)

**The finding.** A teacher of Classes 6–8 used Saathi on her own phone and said her
students cannot hold two paragraphs, and that comprehension across one classroom
varies far too much for a single block of text to reach all of them. The content
proves her right: Class 6 Lesson 1 says *"cut one roti into 4 equal pieces"* and
shows nothing. Across all fifteen lessons there is **not one image, diagram or
sound** — 215 words of prose per lesson and a formula.

This is the most valuable feedback the product has received, and it says the core
content model is wrong rather than under-polished.

**The change.** The unit of a lesson stops being a page and becomes a **step**: one
screen, one idea, one picture, and often one thing to tap. Six to nine steps per
lesson; `est_minutes` stays at 4, because this redistributes attention rather than
adding content. Full contract in `docs/specs/interactive-lessons.md`.

### The pedagogy is named, not invented

**Concrete → Pictorial → Abstract.** Notation never appears before the picture that
earns it — `$\frac{1}{4}$` only after a shape has been cut into four. This is the
established sequence for middle-school mathematics, and today's lessons skip
straight to abstract with a story attached.

### Five primitives, not forty-five illustrations

`PartWhole`, `NumberLine`, `TokenRow`, `BalanceScale`, `ArrayGrid` — parameterised
SVG components instantiated roughly sixty times across three chapters. **This is
the decision that makes the work authoring rather than illustration**, and it is
why this is a two-day slice and not a three-week one.

### Animated SVG, deliberately NOT video

Video was considered and rejected on the constraint that governs every other media
decision in this product: **data costs the learner money** (design constraint 4). A
30-second explainer is 2–5MB; three per lesson across fifteen lessons in two
languages is a curriculum the target family pays to watch. Production is also
thirty narrated recordings, and a content fix means re-recording rather than
editing a number.

Animated SVG delivers the thing video would actually buy — showing a process
*unfold* rather than describing it — at roughly one-thousandth the size: a roti
cut into four, a counter hopping along a number line, a `+1` and a `−1` chip
sliding together and vanishing. Language-neutral, so it never doubles for Hindi,
and it honours `prefers-reduced-motion` (D10).

Real video belongs in Phase 2 with proper production, not squeezed into a slice.

### Audio, with its own language

The teacher's sharpest point, and the one nobody would have predicted: **the spoken
language is chosen separately from the written one.** A learner reading the English
lesson may want it explained in Hindi.

Web Speech API — zero files, zero bytes, no API cost, and bilingual for free.
Feature-detected: no `hi-IN` voice on the device and the control is not rendered at
all, rather than rendered broken.

### A lesson never grades

A wrong tap inside a lesson shows the correct answer with its picture and moves on
— amber, one line of why, no score, no retry gate, and **nothing written to
`attempts`**. Assessment is practice and quiz. A lesson that tests is a lesson a
learner who is already behind stops opening, which is the same reasoning as D17.

### Practice becomes pictorial. The quiz does not.

Practice adopts the mechanic that matters from Duolingo, which is not the pictures
— it is that **you never type**. The learner taps a diagram or builds the answer
from a tile bank.

Two real defects fall out of this for free: the missing `/` key on an Android
keyboard (reported from a phone on 1 Aug), and the recurring-decimal problem, where
`5/12` demands six decimal places (backlog item 0b) — a learner choosing from tiles
never has to decide how to round.

**The chapter quiz stays as it is.** It is the assessment surface; keeping its input
plain keeps it comparable across attempts, and one interactive surface at a time is
enough.

### `steps` is additive, and that is what de-risks it

```
lesson.steps present → the step player
lesson.steps null    → body_md, exactly as today
```

One nullable `jsonb` column (migration 0020). Nothing migrated, nothing deleted.
Class 6 can be interactive while Classes 7 and 8 are untouched, with no broken
state in between — so the build can stop at any hour and ship what is authored,
while the deployed app is in real learners' hands.

### And one thing that follows from all of it

**Wide distribution is held until this ships.** Sending a version we already know is
boring to twenty teenagers spends the one honest ask available from a nephew's
classmates, on a finding we already have. The feedback that matters — a teacher's
verdict, six defects found on a real phone — is already collected. More responses
saying "it was dull" would add nothing and would burn the audience for the version
worth trying.

## Resolved PRD gaps

| Gap | Resolution | Date |
|---|---|---|
| Template instructions left in §12 and §13 | Removed from `.docx` and `PRD.md` | 2026-07-28 |
| §3 and §12 hypotheses contradicted each other | Merged to canonical H1–H7 (D12), applied to both | 2026-07-28 |
| Milestones/achievements required by §9 but unspecified | D7b | 2026-07-28 |
| §13 architecture diagram was ASCII art, poorly laid out | Replaced; generator at `scripts/gen-architecture-diagram.py` | 2026-07-28 |
| §4 TAM/SAM/SOM had no numbers | Sized India-only, derivation in `MARKET_AND_PRICING.md` | 2026-07-28 |
| No monetisation model anywhere | D14 above, applied to PRD §4 | 2026-07-28 |

**Correction to an earlier note:** §13 was previously recorded here as having an
"empty diagram placeholder". It was not empty — it held an image that text
extraction could not see. It was replaced on quality grounds, not absence.

## Still open

- Market inputs are **derived estimates, not commissioned research.** Assumption A3
  (~62% NCERT curriculum alignment) is the weakest input and swings SAM by roughly
  ±10M learners. Verify against state-board textbook adoption before external use.
