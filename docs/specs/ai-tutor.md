# Spec: AI Tutor

**Build slice:** 2.3 (tutor), plus hints used by 2.2
**Implements:** D11 (cost, latency, safety), D16 (Hindi), D6 (struggle)
**Depends on:** lesson screen (1.4) · `concept_mastery` (2.2)
**Skill:** `saathi-ai` · **Design:** `saathi-design` → AI Tutor chat

---

## 1. What makes this different from ChatGPT with a syllabus

Two properties, and they are the demo's centrepiece:

> **Grounded** — every call carries the current lesson's `body_md` **and** the
> learner's concept mastery. The tutor knows which concept is weak.
>
> **Hints before answers** — it never leads with the solution.

---

## 2. Model and cost (D11)

`claude-sonnet-5`, streaming. Budget ₹4.2/learner/week intro, ₹6.4 standard, capped
at ₹7. Rate limit **30 messages/hour/learner, server-side** — normal usage cannot
overspend, a retry loop can.

> **Caching gotcha:** Sonnet 5 will not cache a prefix under **1024 tokens** — it
> fails silently, with no error and no discount. Keep system prompt + lesson
> grounding above that, and verify `usage.cache_read_input_tokens > 0` once running.
> Caching is worth ~40% of tutor cost.

---

## 3. Prompt structure

Cacheable prefix (stable across turns, must exceed 1024 tokens):
system prompt → lesson `body_md` **in the learner's locale** → concept mastery summary.
Then the conversation turns.

System prompt must state, positively and early:
- Explain within this lesson's content
- Hint first; give the full answer only after the learner has tried
- Reply in the learner's language (`en` | `hi`)
- Redirect off-curriculum questions warmly back to the lesson
- **Never request personal information from a minor**
- Never point off-platform

---

## 4. API contract

| Route | Behaviour |
|---|---|
| `POST /api/tutor` | Zod `{ lesson_id, message }`. Rate-limited 30/hr/learner → `429`. Loads grounding, streams the response, persists **both** turns to `tutor_messages`, writes one `ai_calls` row, evaluates D6 trigger 3. Emits `ai_question_asked`. |
| `POST /api/hints` | Zod `{ question_id, tier }`. Returns tier 1/2/3 hint, grounded in the question and concept. **Never returns `answer_value`.** |
| `POST /api/tutor/feedback` | Zod `{ tutor_message_id, helpful }`. Writes `tutor_feedback`. Emits `tutor_feedback_given`. |

Streaming is required, not a nice-to-have — on 4G a learner staring at an unchanged
screen assumes the app is broken.

---

## 5. Components

`components/learn/TutorSheet.tsx` — bottom sheet over the lesson, never a separate
route. `lib/ai/tutor.ts`, `lib/ai/hints.ts`, `lib/ai/prompts/*.ts` (prompts as named
template functions, never inlined at the call site).

---

## 6. Analytics

`ai_question_asked` per learner turn · `tutor_feedback_given` per thumb ·
one `ai_calls` row per model call, which **must never fail the user's request** —
log and swallow.

---

## 7. Acceptance criteria

**Grounding — the differentiator**
- [ ] Every tutor call includes the current lesson's `body_md` and the learner's concept mastery, verified by logging the assembled prompt once
- [ ] Grounding uses the body in the **learner's locale** — a Hindi learner's call carries the Hindi body, not the English one
- [ ] Asked about something outside the lesson, the tutor redirects warmly instead of answering
- [ ] Asked a question the lesson does not cover, it says so rather than inventing content

**Behaviour**
- [ ] "Just tell me the answer" produces a hint, not the answer
- [ ] The full answer is only given after the learner has attempted
- [ ] A Hindi-locale learner gets Hindi replies, in the conversational register of `HINDI_STYLE.md` (तुम, not आप) — not textbook Hindi and not English
- [ ] The tutor never asks for name, school, location, phone or any personal detail
- [ ] The maths in its explanations is correct — spot-check 10 responses by hand

**Performance & cost (D11)**
- [ ] First token under 2s at p75
- [ ] The thinking indicator appears immediately on send, before any token arrives
- [ ] `usage.cache_read_input_tokens > 0` on the second and later turns of a conversation — **if this is 0, caching is silently broken and cost is ~40% higher**
- [ ] The 31st message in an hour returns `429` with a friendly in-locale message, not a crash
- [ ] One `ai_calls` row per call with real token counts and `cost_inr`
- [ ] Forcing a logging failure does not break the tutor response

**Persistence & feedback**
- [ ] Both turns persist to `tutor_messages`; reopening the lesson shows the history
- [ ] Thumbs up/down is one tap with no dialog, and writes to `tutor_feedback`

**Accessibility**
- [ ] The sheet traps focus while open and restores it on close
- [ ] Streaming text is announced politely, not re-announced on every token
- [ ] Learner and tutor messages are distinguishable without relying on colour

---

## 8. Edge cases

| Case | Required behaviour |
|---|---|
| **Anthropic API down or times out** | In-locale "The tutor isn't available right now" with a retry, and the lesson stays usable. **Rehearse this** — it is the most likely live-demo failure (BUILD_PLAN 4.6). |
| **Stream breaks mid-response** | Keep the partial text, offer retry. Never blank out what the learner already read. |
| **Prompt injection in the learner's message** ("ignore your instructions") | Instructions live in the system prompt; learner text is data. Verify with an explicit attempt in the golden set. |
| **Learner asks something upsetting or personal** | Respond kindly, do not engage, redirect to the lesson, and surface the mentor CTA (D6). Never ask follow-up personal questions. |
| **4+ tutor turns with no practice attempt** | D6 trigger 3 — surface the mentor CTA. Dismissible. |
| **Learner switches language mid-conversation** | Subsequent replies switch language. Prior messages stay as sent — do not retro-translate the transcript. |
| **Lesson has no Hindi body** | Ground in English but **instruct the reply in Hindi**. This is the on-the-fly translation path `i18n.md` flags as the one that can produce wrong maths — which is why all three chapters now ship Hindi content, so this path should never fire in normal use. |
| **Very long conversation** | Cap history sent; keep the cacheable prefix stable so caching keeps working. Retain transcripts 90 days (D11). |
