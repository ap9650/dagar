# Spec: Guided Practice & Grading

**Build slice:** 2.1 (grading), 2.1b (grading tests — **do not skip**), 2.2 (practice)
**Implements:** D3 (grading + adaptivity), D5 (mastery), D6 (struggle), D7 (streak)
**Depends on:** content seeded (1.2) · lesson screen (1.4)
**Design:** `dagar-design` → Practice question, feedback states

---

## 1. The two rules that own this spec

> **1. Answer keys never reach the client.** Read questions through
> `questions_public`. Grade in the route handler with the service role. A client-side
> `if (answer === correct)` is a bug, not a shortcut.
>
> **2. Grading is deterministic code, not AI.** `lib/learning/grading.ts` owns it.
> AI writes hints and explanations only.

A grading bug fails **silently** and tells a learner they are wrong when they are
right — for a learner already behind, that is the most damaging thing this app can
do. Hence slice 2.1b is non-optional.

---

## 2. Grading rules (D3)

| `answer_type` | Rule |
|---|---|
| `mcq` | Exact match on choice **id** (never the label — labels are translated) |
| `integer` | Parse to int, exact match. `- 7` == `-7` |
| `fraction` | Normalise to lowest terms. `2/4`, `1/2`, `0.5` all match `1/2` |
| `decimal` | Compare within `1e-6` |
| `expression` | Normalise whitespace + operator order for Class 8 linear equations; falls back to string compare. `x = 4` == `x=4` |

Whitespace is trimmed for every type. **Sign errors always stay wrong** — `7` never
matches `-7`.

`grade()` takes no locale and imports nothing from i18n (see `i18n.md`).

---

## 3. Adaptivity (D3)

Selection from the seeded bank by difficulty — **never generation**.

- 2 correct in a row → step difficulty up (max 3)
- 2 wrong in a row → step down (min 1) **and serve a worked example**
- Start at difficulty 1, or the learner's current level for that concept

---

## 4. API contract

| Route | Behaviour |
|---|---|
| `GET /api/practice/[conceptId]/next` | Returns the next question from `questions_public` at the current difficulty. **Response contains no `answer_value` and no `solution_md`.** |
| `POST /api/attempts` | Zod `{ question_id, given_answer, hints_used, ms_taken, session_kind }`. Grades server-side with the service role. Writes `attempts`, recomputes `concept_mastery` (D5), recomputes streak if the 5-question threshold is crossed (D7), evaluates struggle triggers (D6), awards milestones (D7b). Returns `{ is_correct, solution_md, next_difficulty, mastery, streak, milestonesEarned[], showMentorCta }`. |
| `POST /api/hints` | Returns the next hint tier for a question. See `ai-tutor.md` — AI-generated, grounded, never the final answer. |

Rate limit `POST /api/attempts` per learner to block a scripted loop.

---

## 5. Components

| File | Responsibility |
|---|---|
| `lib/learning/grading.ts` | Pure. No I/O, no locale, no AI. |
| `lib/learning/adaptivity.ts` | Difficulty stepping + next-question selection |
| `lib/learning/mastery.ts` | D5 computation |
| `app/(learn)/practice/[concept]/page.tsx` | The practice screen |
| `components/learn/AnswerInput.tsx` | Per `answer_type` — numeric keypad for integer/decimal |
| `components/learn/FeedbackPanel.tsx` | Correct / not-quite / hint states |

---

## 6. Analytics

`practice_started` on entering a set · `practice_completed` on finishing ·
`streak_extended` and `milestone_earned` from the attempt path ·
`mentor_request_submitted` only if the learner accepts the CTA.

---

## 7. Acceptance criteria

**Grading correctness — unit tests, slice 2.1b**
- [ ] `grade("1/2","fraction","2/4")` → true
- [ ] `grade("1/2","fraction","0.5")` → true
- [ ] `grade("1/2","fraction"," 1/2 ")` → true
- [ ] `grade("-7","integer","- 7")` → true
- [ ] `grade("-7","integer","7")` → **false** — sign errors stay wrong
- [ ] `grade("x=4","expression","x = 4")` → true
- [ ] Empty string, `null`, and non-numeric garbage return false without throwing
- [ ] Every `answer_type` has at least one passing and one failing case
- [ ] A Hindi-locale learner's answer grades identically to the same answer in English

**Security**
- [ ] The `GET .../next` response body contains no `answer_value` and no `solution_md` — verified by inspecting the actual network response, not by reading the code
- [ ] `questions_public` does not expose `answer_value`; querying `questions` directly as an authenticated learner is denied by RLS
- [ ] Posting a fabricated `is_correct` from the client has no effect — the server regrades

**Adaptivity**
- [ ] Two correct in a row raises difficulty; two wrong lowers it and shows a worked example
- [ ] Difficulty never exceeds 3 or drops below 1
- [ ] Questions come from the seeded bank — no AI-generated question ever appears

**Feedback (design)**
- [ ] A wrong answer is **amber** (`#FEF3C7` / `#B45309`), never red
- [ ] A wrong answer always shows a next step — a hint or a worked example — never a bare mark
- [ ] Correct shows `#DCFCE7`/`#15803D` plus one line of *why*, not just a tick
- [ ] Correctness is signalled by icon and text, not colour alone

**State**
- [ ] `concept_mastery` recomputes on each attempt per D5 (last 5 attempts, ≥0.8 with ≥3 → Mastered)
- [ ] Five practice questions in a day extends the streak, matching the daily goal ring
- [ ] The mentor CTA appears on any D6 trigger and is dismissible, never a modal

**Accessibility**
- [ ] Numeric answers open a numeric keypad on mobile
- [ ] The answer input is reachable and submittable by keyboard alone
- [ ] Feedback is announced to assistive tech, not conveyed only visually

---

## 8. Edge cases

| Case | Required behaviour |
|---|---|
| **Learner submits blank** | Inline "Type an answer first". No attempt row is written — a blank must never count against mastery. |
| **Double-submit** | Idempotent per `(question_id, submission)`. One attempt row, one mastery recompute. |
| **Network fails after grading, before response** | On retry, the server must not write a second attempt. |
| **Answer key wrong in seeded content** | Not a code bug — a content bug, and invisible from the app. This is why `dagar-content` requires verifying every key at authoring time. |
| **Learner exhausts all hints and is still wrong** | Show the worked solution. Never leave them stuck with nothing left to try. |
| **Fewer than 5 attempts on a concept** | Mastery shows "not enough attempts yet", not 0%. 0% reads as failure; "not started" is the truth. |
| **All questions at a difficulty exhausted** | Serve from the adjacent difficulty rather than repeating immediately, and never show an empty practice screen. |
| **Unicode digits pasted in (`१/२`)** | Reject cleanly as unparseable rather than silently mis-grading. Answers are Arabic numerals (`i18n.md`). |
