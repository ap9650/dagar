# Spec: Micro-lesson

**Build slice:** 1.4
**Implements:** D17 (in-lesson progress), D7 (streak on completion), D7b (`first_lesson`)
**Depends on:** dashboard (1.3) · content seeded (1.2)
**Flow:** `SCREENS.md` Flow 2 · **Design:** `dagar-design` → Micro-lesson, In-lesson progress

---

## 1. What this screen is

`/learn/[chapter]/[lesson]` — a short, readable explanation of one concept, with the
AI Tutor one tap away and practice at the end. This plus practice plus the tutor is
**the product**; everything else is evidence for it.

Structure per `dagar-content`: hook → explain → worked example → "you try" pointer
into practice.

---

## 2. Data

Reads `lessons` (resolved to locale), `lesson_progress`.
Writes `lesson_progress`, and on completion triggers streak + milestone recompute.

---

## 3. API contract

| Route | Behaviour |
|---|---|
| `POST /api/lessons/[id]/start` | Upserts `lesson_progress` to `started`. Idempotent — reopening a lesson does not reset `started_at`. Emits `lesson_started` on first start only. |
| `POST /api/lessons/[id]/complete` | Sets `completed`, `completed_at`. Then, **server-side and in this order**: recompute streak (D7) → award milestones (D7b) → return `{ streak, milestonesEarned[] }`. Emits `lesson_completed`. Idempotent. |

**Never trust a client-supplied streak or completion count.** The response tells the
client what happened; the client never tells the server.

---

## 4. Components

| File | Responsibility |
|---|---|
| `app/(learn)/learn/[chapter]/[lesson]/page.tsx` | Server component, fetches and resolves locale |
| `components/learn/LessonBody.tsx` | Markdown + KaTeX rendering |
| `components/learn/LessonProgress.tsx` | Dots, step *n* of *m* (D17) |
| `components/learn/TutorSheet.tsx` | Bottom sheet over the lesson — see `ai-tutor.md` |
| `components/learn/MilestoneToast.tsx` | Shared, fired from the completion response |

**The tutor is a sheet over the lesson, not a route.** A learner who navigates away
to ask about the lesson has lost the thing they were confused about.

---

## 5. Analytics

| Event | When |
|---|---|
| `lesson_started` | First `start` call for this learner+lesson |
| `lesson_completed` | Successful `complete` call |
| `streak_extended` | From the completion path, when the streak actually increments |
| `milestone_earned` | Per milestone awarded, with `code` |

---

## 6. Acceptance criteria

**Reading**
- [ ] Lesson body renders in the learner's locale, falling back to English if Hindi is absent
- [ ] KaTeX renders correctly inline and in display mode, in both locales
- [ ] Long display math scrolls **inside its own container** — the page never scrolls horizontally at 360px
- [ ] Worked examples are visually distinct (tinted panel, teal left border) from body copy
- [ ] Devanagari body renders at 18px/1.75, Latin at 17px/1.6

**Progress (D17)**
- [ ] Progress dots show step *n* of *m* at the top of the lesson from the moment it opens
- [ ] The dots reflect real position, not a fake animation

**Completion**
- [ ] Marking complete persists — reload shows the lesson as completed
- [ ] Marking complete twice does not double-count, double-award, or double-extend the streak
- [ ] The first ever completion awards `first_lesson` and shows the milestone toast
- [ ] Completing a lesson extends the streak to 1 for a new learner, and `streak_extended` appears in `events`
- [ ] Completing a second lesson the same day does **not** increment the streak again
- [ ] After completion, the next action is on screen — next lesson or practice. Never a dead end.

**Accessibility (D10)**
- [ ] Fully keyboard navigable, including opening and closing the tutor sheet
- [ ] The tutor sheet traps focus while open and returns focus to the trigger on close
- [ ] Milestone toast honours `prefers-reduced-motion`
- [ ] Text reflows at 200% zoom with no horizontal scroll

---

## 7. Edge cases

| Case | Required behaviour |
|---|---|
| **Complete called twice (double tap / retry)** | Idempotent. Second call returns the same state, awards nothing new. Emits no second event. |
| **Network fails on complete** | The lesson stays marked complete **locally with a retry**, and the learner is not blocked from continuing. Losing a completion to a dropped 4G packet is a real occurrence for this audience, not a hypothetical. |
| **Lesson has no Hindi translation** | Renders English body with the UI still in Hindi. A safety net, not an expected path — all three chapters ship Hindi. Must still look deliberate if it fires. |
| **Malformed KaTeX in seeded content** | Render the raw source in a monospace span, never a red crash block. A content typo must not take down the lesson screen. |
| **Learner opens a lesson from a chapter they haven't started** | Allowed. Nothing is locked (D17 rejects gating). Progress simply records what they did. |
| **Streak recompute fails but completion succeeded** | Completion is the source of truth and stays. Streak recomputes on the next write. Never roll back a completed lesson because a streak query failed. |
| **Learner switches language mid-lesson** | Re-renders in place, same lesson, same scroll position. |
