# Spec: Curriculum Dashboard

**Build slice:** 1.3
**Implements:** D1 (scope), D17 (journey layout, daily goal), D5 (mastery display)
**Depends on:** profiles exist (1.1) · content seeded (1.2)
**Flow:** `SCREENS.md` Flow 2 · **Design:** `dagar-design` → Journey layout, Daily goal ring, Streak

---

## 1. What this screen is

`/learn` — the learner's home. First screen after onboarding, and the one they
return to daily. Three jobs, in priority order:

1. **Tell them what to do next** — one obvious next action, not a menu
2. **Show progress they can see** — journey path, not a percentage
3. **Sustain the habit** — streak in the header, daily goal ring at the top

> Per D17 this is a **journey/path layout, not a flat list.** A vertical sequence of
> nodes with a visible "you are here". Completed nodes filled `#0F766E`, current node
> ringed and larger, upcoming nodes `#D8DEE4` outline.

---

## 2. Data

Reads: `chapters`, `concepts`, `lessons` (filtered to `profiles.grade`),
`lesson_progress`, `concept_mastery`, `streaks`, `milestones`.
Writes: nothing. This screen is read-only.

All reads resolve through `t(row, field, locale)` (see `i18n.md`).

**One server component, one round of queries.** Do not fetch per-chapter from the
client — on 4G that is the difference between a 1s and a 4s dashboard.

---

## 3. API contract

No route handler. This is a React Server Component reading through
`lib/supabase/server.ts` under the learner's own session, so RLS enforces the
boundary rather than application code.

Next-lesson selection comes from `lib/learning/adaptivity.ts`:

```ts
recommendNextLesson(studentId, grade) → { lesson, reason }
```

Rule: first incomplete lesson in `order_index` order. If all lessons are complete
but some concepts are unmastered, recommend **practice** on the weakest concept
(lowest `concept_mastery.score`) instead of a lesson.

`reason` is shown to the learner — "Continue where you left off" / "Let's
strengthen भिन्न". Never surface a bare recommendation with no explanation.

---

## 4. Components

| File | Responsibility |
|---|---|
| `app/(learn)/learn/page.tsx` | Server component. All data fetching. |
| `components/learn/JourneyPath.tsx` | The node sequence with you-are-here |
| `components/learn/DailyGoalRing.tsx` | 72px ring, D17 |
| `components/learn/StreakBadge.tsx` | Header flame — shared with every learn screen |
| `components/learn/NextLessonCard.tsx` | The single primary CTA |

---

## 5. Analytics

None fire on view. `lesson_started` fires on the lesson screen, not here — a tap
that never loads is not a start.

---

## 6. Acceptance criteria

**Content**
- [ ] A Class 6 learner sees only the Class 6 chapter; changing grade in Settings changes what appears
- [ ] Every chapter, concept and lesson title renders in the learner's locale, falling back to English where Hindi is absent
- [ ] Concepts marked Mastered (D5: ≥0.8 over last 5 attempts, ≥3 attempts) show the mastery badge; others do not

**Journey layout (D17)**
- [ ] Lessons render as a **vertical path of nodes**, not a flat list or table
- [ ] Exactly one node is marked as current, and it is visually larger/ringed
- [ ] Completed nodes are filled, upcoming nodes are outlined
- [ ] The current node is in view on load without scrolling, on a 360px screen

**Next action**
- [ ] Exactly one primary CTA is visible above the fold
- [ ] It carries a human-readable reason, not just "Continue"
- [ ] With all lessons complete but a concept unmastered, the CTA recommends practice on the **weakest** concept
- [ ] A brand-new learner sees "Start here" on lesson 1 — never an empty dashboard

**Habit**
- [ ] The streak flame is visible in the header with the correct day count
- [ ] A broken streak reads "Start again today", never a loss message
- [ ] The daily goal ring shows progress toward **one lesson or five practice questions** — the same rule as the streak (D7)
- [ ] Completing the goal fills the ring, celebrates once, then stops asking. No second goal is offered.

**Performance & a11y**
- [ ] Dashboard is interactive in under 3s on a throttled 4G profile (D11)
- [ ] The whole path is keyboard-navigable with a visible focus ring on each node
- [ ] Node state is conveyed by shape/icon as well as colour
- [ ] Every node is ≥44px tall
- [ ] No horizontal scroll at 360px, and none at 200% zoom

---

## 7. Edge cases

| Case | Required behaviour |
|---|---|
| **Brand-new learner, zero progress** | The demo's first minute. "Start here" on lesson 1, ring at 0, streak absent — designed, not blank. |
| **Content not seeded for the learner's grade** | Empty dashboard is the worst possible failure. Show "Your class is coming soon" with a working link to another grade's content — never a white screen. |
| **All lessons complete, all concepts mastered** | Chapter-complete state with the `chapter_mastered` milestone and a revision CTA. Never a dead end. |
| **Grade changed in Settings mid-way** | Show the new grade's chapter. Progress on the old grade is retained, not deleted — a mis-tap must be reversible. |
| **`concept_mastery` row absent** | A concept never attempted has no row. Treat as score 0, attempts 0 — do not crash on `null`, and do not show it as 0% Mastered, which reads as failure rather than "not started". |
| **Streak grace day active** | Lighter flame, not a gap and not a reset (D7). |
| **Very long Hindi chapter title** | Wraps to two lines; the node does not clip or ellipsis mid-word. |
