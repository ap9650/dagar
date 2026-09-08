# Dagar — Screens & Flows

Every screen in the MVP, in the order a user meets them.

**This document owns flow — what comes after what, and what state each screen needs.**
It does not own appearance (that's the `dagar-design` skill) or rationale (that's
`DECISIONS.md`). Each screen below points at both.

If this file and `DECISIONS.md` disagree, **`DECISIONS.md` wins** and this file gets
corrected.

---

## Route map

| Route | Who | Screen |
|---|---|---|
| `/` | anyone | Splash → redirects by auth state |
| `/welcome` | new | **Language picker** (first screen, D16) |
| `/login` | new | Google Sign-In + email fallback (D2) |
| `/onboarding/grade` | new learner | Grade 6 / 7 / 8 |
| `/learn` | learner | Dashboard — journey layout (D17) |
| `/learn/[chapter]` | learner | Chapter path — lessons as nodes |
| `/learn/[chapter]/[lesson]` | learner | Micro-lesson + tutor entry |
| `/practice/[concept]` | learner | Guided practice |
| `/quiz/[chapter]` | learner | Chapter quiz |
| `/progress` | learner | Mastery, streak, milestones |
| `/settings` | learner | **Language toggle**, grade, name, sign out |
| `/parent/claim` | parent | Enter 6-char link code |
| `/parent` | parent | Read-only child view |
| `/admin/metrics` | you | Events + AI health |

Learner routes live under `app/(learn)/`, parent under `app/(parent)/`.

---

## Flow 1 — Learner onboarding (first ever launch)

```
  ┌─────────────┐
  │  /welcome   │   LANGUAGE PICKER
  │             │   English  |  हिंदी
  └──────┬──────┘   No text above it that requires reading either language
         │          Writes locale to the `saathi_locale` cookie (no account yet)
         ▼
  ┌─────────────┐
  │   /login    │   [ Continue with Google ]   ← primary
  │             │   [ Use email instead   ]   ← fallback
  └──────┬──────┘   Already in the chosen language
         │
         ▼
  ┌─────────────┐
  │ /onboarding │   "Which class are you in?"
  │   /grade    │   [ 6 ]  [ 7 ]  [ 8 ]
  └──────┬──────┘   Creates profile: role=student, grade, locale
         │          → learner_registered
         ▼
  ┌─────────────┐
  │   /learn    │   Dashboard: one next action + EVERY chapter of their grade
  └─────────────┘
```

### Why language comes before login

A learner who cannot read English must not have to get through an English screen to
reach the language picker (D16). This is the single most important ordering decision
in the product and the easiest one to get backwards.

**Consequence for implementation:** the picker runs *before* there is a user row, so
locale lives in the `saathi_locale` **cookie** first and is written to
`profiles.locale` at the moment the profile is created. Do not build the picker as a
"profile settings" screen that requires auth.

A cookie rather than `localStorage`: the locale has to be known on the **server**, or
the first paint is English and then flips to Hindi on hydration. `localStorage` cannot
be read during a server render. See `docs/specs/i18n.md` §3.

### Screen detail

| Screen | Must have | Must not have |
|---|---|---|
| `/welcome` | Two 64px cards, each label in its own script, check icon on select | Flags. Auto-skip based on device locale. Any explanatory paragraph |
| `/login` | Google button first; email/password below a divider | Phone OTP — **DLT-blocked in India** (D2). Do not add it "just in case" |
| `/onboarding/grade` | Three large tap targets | Free-text age entry. Any question about school, city, or name beyond display name — never ask a minor for personal information |

`display_name` comes from the Google profile. On email signup, ask for a first name
only, and let them skip it.

### Returning learner

`/` reads the session → straight to `/learn`. **Never re-show the language picker**
to someone with a `profiles.locale` already set — that is what `/settings` is for.

---

## Flow 2 — The core learning loop

This is the demo, and the four screens that must never be cut.

```
   /learn  ─────────────────►  /learn/[ch]/[lesson]
   journey layout              micro-lesson, progress dots
   daily goal ring                  │
   streak in header                 ├──► AI Tutor (sheet over lesson)
        ▲                           │
        │                           ▼
        │                    /practice/[concept]
        │                    hints → difficulty steps
        │                           │
        │                           ▼
        └──────────────────   /quiz/[chapter]  ──►  /progress
                              mastery band            streak, milestones
```

| Screen | State it needs | Events |
|---|---|---|
| `/learn` | grade, progress across ALL chapters, streak, today's goal | `dashboard_viewed` `recommendation_clicked` |
| `/learn/[chapter]` | that chapter's lessons + concept mastery | `chapter_opened` |
| `/learn/[ch]/[lesson]` | `body_md` in locale, step n of m | `lesson_started` `lesson_completed` |
| Tutor sheet | lesson `body_md` + concept mastery (**grounding, always**) | `ai_question_asked` `tutor_feedback_given` |
| `/practice/[concept]` | questions via `questions_public`, current difficulty | `practice_started` `practice_completed` |
| `/quiz/[chapter]` | fixed question set, no hints | `quiz_submitted` |
| `/progress` | mastery per concept, streak, earned + unearned milestones | `streak_extended` `milestone_earned` |

**Wherever a screen shows a diagnosis, it offers the treatment in the same
place.** A mastery badge reading "Keep practising" must be tappable, and it must
go to that concept's practice. This is a rule and not a detail: the chapter
screen listed every concept with its band and made none of them tappable, so a
learner who had finished all five Fractions lessons could see that Fraction
Basics was weak and had no way to act on it — the concept spans lessons 1–2 and
practice is offered at a concept *boundary*, so the only routes were the foot of
lesson 2 or `/progress`. Naming a weakness and withholding the fix is worse than
saying nothing, for a learner who is already behind.

One `ConceptRow` component serves `/learn/[chapter]` and `/progress` for exactly
this reason: the same row existed twice with the affordance in only one copy.

**The tutor is a sheet over the lesson, not a separate page.** A learner who
navigates away from the lesson to ask about it has lost the thing they were confused
about.

---

## Flow 3 — Parent

```
  Learner /settings ──► "Invite a parent" ──► shows 6-char code
                                                    │
              (spoken, or sent over WhatsApp)        │
                                                    ▼
                                            /parent/claim
                                            enter code + sign in
                                                    │
                                                    ▼
                                              /parent  (read-only)
```

Parent locale **defaults to the learner's** on claim, then switchable independently
(D16). The weekly summary uses the *parent's* locale.

`/parent` is read-only, always. If a parent write path exists anywhere, it is a bug.

---

## Flow 4 — Settings

Small screen, disproportionate importance: **without it, a learner who taps the wrong
language at onboarding is permanently stuck in a language they cannot read.**

Contains: language toggle (same component as `/welcome`), grade, display name,
invite-a-parent code, sign out.

Changing language re-renders in place. It never signs the learner out and never
resets progress.

---

## Empty and error states

Every screen needs its first-run state designed, because **every screen is empty at
the demo's first minute.**

| Screen | Empty state |
|---|---|
| `/learn` | Chapter card + "Start here" on the first lesson. Never a blank journey |
| `/progress` | The unearned milestones, greyed — so there is always a visible next goal |
| `/parent` | "No activity yet this week" + what will appear once there is |
| Tutor | Two or three suggested questions for this lesson, tappable |

Errors are the **only** place red appears. A wrong answer is amber. A failed network
call is red, and always offers a retry.

---

## What this MVP deliberately has no screen for

Mentor dashboard (D8 — requests are captured, no UI), teacher/NGO views, subject
picker (maths only), leaderboards or league tables (D17), and any screen that asks a
learner for personal information.
