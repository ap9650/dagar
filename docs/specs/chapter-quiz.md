# Spec: Chapter Quiz

**Build slice:** 2.4
**Implements:** D5 (mastery bands), D7b (`chapter_mastered`)
**Depends on:** grading engine (2.1) · content seeded (1.2)
**Design:** `saathi-design` → Practice question, Progress

---

## 1. How a quiz differs from practice

Same grading engine, deliberately different rules:

| | Practice | Quiz |
|---|---|---|
| Question set | Adaptive, from the bank | **Fixed set, no adaptation mid-quiz** |
| Hints | Yes, escalating | **None** |
| Feedback | Immediate per question | **On submit, all at once** |
| Output | Mastery drift | **Mastery band** (D5) |

Adapting difficulty mid-quiz would make the score meaningless — it must measure the
learner, not track them.

---

## 2. Mastery bands (D5)

| Score | Band |
|---|---|
| < 50% | `needs_revision` |
| 50–79% | `developing` |
| ≥ 80% | `mastered` |

Copy is never punitive. `needs_revision` reads "Let's go over a few things again",
never "Failed" and never `असफल`.

---

## 3. API contract

| Route | Behaviour |
|---|---|
| `POST /api/quiz/[chapterId]/start` | Creates a `quiz_sessions` row, returns the fixed question set from `questions_public` (`kind: "quiz"`). **No `answer_value`, no `solution_md`.** |
| `POST /api/quiz/[sessionId]/submit` | Zod `{ answers: [{ question_id, given_answer }] }`. Grades all server-side, writes one `attempts` row per answer with `session_kind: "quiz"`, computes score and band, recomputes `concept_mastery`, awards milestones, returns `{ score, total, band, perQuestion[], milestonesEarned[] }`. Emits `quiz_submitted`. |

Solutions are returned **only in the submit response**, never at start.

---

## 4. Analytics

`quiz_submitted` with `{ chapter_id, score, total, band }`. Milestones as earned.

---

## 5. Acceptance criteria

**Rules**
- [ ] The question set is fixed at start and identical on reload — refreshing mid-quiz does not reshuffle or re-serve
- [ ] No hint control appears anywhere in the quiz
- [ ] No per-question feedback appears before submit
- [ ] Difficulty does not adapt mid-quiz

**Security**
- [ ] The start response contains no `answer_value` and no `solution_md` — verified in the actual network response
- [ ] A client-submitted score is ignored; the server regrades every answer
- [ ] Solutions appear only after submit

**Scoring**
- [ ] Bands map exactly to D5: 49% → `needs_revision`, 50% → `developing`, 80% → `mastered`
- [ ] Every quiz answer writes an `attempts` row with `session_kind: "quiz"` and the `quiz_session_id`
- [ ] `concept_mastery` recomputes after submit
- [ ] Mastering every concept in a chapter awards `chapter_mastered` exactly once

**Copy & design**
- [ ] `needs_revision` copy is encouraging, never punitive; the words "fail"/"असफल" appear nowhere
- [ ] Wrong answers on the results screen are **amber**, not red
- [ ] Every wrong answer shows its worked solution
- [ ] The results screen always offers a next action — revise the weak concept, or practise it

**Accessibility**
- [ ] The whole quiz is completable by keyboard alone
- [ ] Progress through the quiz is announced, not only shown
- [ ] All results are conveyed by text and icon, not colour alone

---

## 6. Edge cases

| Case | Required behaviour |
|---|---|
| **Learner abandons mid-quiz** | The session stays `started` with no score. Returning resumes the **same** question set — never a fresh one, which would let a learner reroll for easier questions. |
| **Submit fails on network** | Answers are held client-side and retried. Losing a completed quiz to a dropped packet is unacceptable — and likely on 4G. |
| **Double submit** | Idempotent on `quiz_session_id`. One score, one set of attempts, one `quiz_submitted` event. |
| **Chapter has fewer quiz questions than expected** | Score out of the actual count. Never pad with practice questions, never show a quiz of 0 questions. |
| **Learner scores 0** | Band is `needs_revision`, copy is warm, every solution is shown, and the CTA is to revise. This learner is the one the product exists for — the screen must not feel like a verdict. |
| **All concepts already mastered before the quiz** | Quiz is still available for revision. Re-awarding `chapter_mastered` is a no-op (unique constraint). |
| **Quiz taken in Hindi** | Stems and solutions in Hindi; `answer_value` untouched; grading byte-identical to English. |
