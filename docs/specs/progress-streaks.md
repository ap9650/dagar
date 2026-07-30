# Spec: Progress, Streaks, Milestones & Daily Goal

**Build slice:** 2.5
**Implements:** D5 (mastery), D7 (streaks), D7b (milestones), D17 (daily goal)
**Depends on:** attempts and lesson completion writing (1.4, 2.2)
**Design:** `saathi-design` → Progress, Streak, Daily goal ring, Milestone toast

---

## 1. The rule that owns this spec

> **Server-side truth.** Streaks, mastery and progress are computed on write, in the
> database or a route handler. **Never trust a client-supplied score or streak.**

The client displays; it never asserts.

---

## 2. Streaks (D7)

- A day counts on **≥1 lesson completed OR ≥5 practice questions**
- Day boundary is **Asia/Kolkata**, stored as a `date`, never a timestamp
- **One grace day per rolling 7** — a single missed day does not reset
- Recomputed server-side on every qualifying write

Storing a timestamp instead of a date is the classic bug here: a learner active at
11pm IST and again at 1am IST has been active on two days, and UTC gets that wrong.

---

## 3. Daily goal (D17)

**The same rule as the streak** — one lesson or five practice questions — so the ring
and the flame can never disagree. Closable in one session. On completion the ring
fills, celebrates once, then **stops asking**. No second goal, no upsell.

---

## 4. Milestones (D7b)

Seven codes: `first_lesson`, `first_practice`, `streak_3`, `streak_7`,
`concept_mastered`, `chapter_complete`, `chapter_mastered`.

Awarded **server-side on the write that triggers them**, idempotent via
unique(`student_id`, `code`). Shown earned **and unearned**, so there is always a
visible next goal.

**Not in MVP:** points, levels, leaderboards, hearts/lives, XP (D17).

---

## 5. API contract

No dedicated routes. Recomputation is triggered inside the lesson-complete and
attempt paths, and `/progress` is a server component reading the results.

```ts
lib/learning/streaks.ts     extendStreak(studentId, date) → { current, longest, graceUsed }
lib/learning/milestones.ts  awardMilestones(studentId, ctx) → earned[]
lib/learning/mastery.ts     recomputeConceptMastery(studentId, conceptId)
```

All three are idempotent. Calling twice for the same day/event changes nothing.

---

## 6. Analytics

`streak_extended` when the streak actually increments (not on every activity) ·
`milestone_earned` per award, with `code`.

---

## 7. Acceptance criteria

**Streak (D7)**
- [ ] Completing one lesson sets the streak to 1
- [ ] Completing a second lesson the same day does **not** increment it again
- [ ] Five practice questions in a day extends the streak; four do not
- [ ] Activity at 11pm IST and 1am IST counts as two separate days
- [ ] Missing one day uses the grace day and **keeps** the streak
- [ ] Missing a second day within the same rolling 7 resets the streak to 0
- [ ] The grace day becomes available again after 7 days
- [ ] Posting a fabricated streak value from the client has no effect
- [ ] `streak_extended` fires on increment only

**Daily goal (D17)**
- [ ] The ring's completion rule is identical to the streak rule — they never show contradictory states
- [ ] The goal is achievable in one session
- [ ] Completing it fills the ring, celebrates once, and then stops prompting
- [ ] No second goal or "keep going" upsell appears after completion

**Milestones (D7b)**
- [ ] Each of the seven codes is awarded under exactly its D7b condition
- [ ] Re-running the awarding path never double-awards — verified by calling it twice
- [ ] Unearned milestones are visible alongside earned ones
- [ ] The toast honours `prefers-reduced-motion`
- [ ] `milestone_earned` fires once per award with the right code
- [ ] No points, levels, XP, hearts or leaderboard appears anywhere in the UI

**Mastery (D5)**
- [ ] Concept score = correct ÷ attempted over the **last 5** attempts
- [ ] Mastered at ≥0.8 with ≥3 attempts; 0.8 with 2 attempts is **not** mastered
- [ ] Chapter mastery = % of the chapter's concepts mastered
- [ ] A concept with no attempts shows "not started", not 0%

**Presentation**
- [ ] Every ring or bar is paired with a number ("3 of 5 lessons")
- [ ] A broken streak reads "Start again today", never a loss message
- [ ] Grace days show as a lighter flame, not a gap
- [ ] The empty progress screen shows unearned milestones, never blank

---

## 8. Edge cases

| Case | Required behaviour |
|---|---|
| **Timezone** | Always Asia/Kolkata, always a `date`. Test explicitly across the 11pm/1am boundary — this is the bug that ships. |
| **Backdated or clock-skewed client time** | The server date is authoritative. A client clock cannot manufacture a streak. |
| **Grace day and a real day both in the window** | Grace is consumed once per rolling 7. Two misses reset. |
| **Concept mastered, then two wrong answers** | Score recomputes over the last 5 and may drop below 0.8. **The `concept_mastered` milestone is not revoked** — a milestone is a moment, not a state. Removing an earned badge would be punitive. |
| **Milestone awarded during a failed transaction** | Idempotent, so a retry is safe. Never award outside the transaction that caused it. |
| **Learner completes a lesson exactly at midnight IST** | Server date decides. Consistent, even if occasionally surprising. |
| **First-ever visit to `/progress`** | Zero state with all seven milestones greyed — a roadmap, not an empty page. |
