---
name: dagar-ai
description: Write or change Dagar's Claude-powered features — the AI Tutor, practice hints, worked explanations, and parent summaries. Use when editing anything under lib/ai/, writing or tuning a system prompt, adding curriculum grounding, streaming a tutor response, or debugging wrong/unsafe/off-topic AI output. Trigger on "AI tutor", "prompt", "hint", "explanation", "grounding", "the AI said something wrong".
---

# Dagar AI features

Dagar is not a chatbot with a syllabus attached. The distinguishing claim in the
PRD is **curriculum-aware, context-aware tutoring** — every AI call must earn that.

## The non-negotiables

**AI never grades and never owns an answer key.** Grading is deterministic code in
`lib/learning/grading.ts`. AI writes hints, explanations, and encouragement. If you
find yourself asking Claude "is this answer correct?", stop — that's D3 being violated
and it will produce a wrong verdict on a live demo.

**AI never invents lesson content.** The tutor is grounded in the seeded
`lessons.body_md` for the learner's current lesson. Content it wasn't given, it
doesn't teach.

**Hints before answers.** On practice, escalate: nudge → method → worked step →
full solution. A learner who gets the answer instantly learned nothing, which is the
exact failure mode of the generic AI assistants the PRD positions against.

**The tutor answers in the learner's language.** Pass `profiles.locale` into the
system prompt and ground it in the Hindi lesson body when locale is `hi`. Claude
handles Hindi natively — this is one prompt line, not a translation layer, and it
is the single highest-impact-per-effort item in the product.

When locale is `hi`, **ground the tutor in the Hindi `body_md`, not the English
one.** Grounding it in English and letting it translate on the fly is how wrong
maths reaches a learner — the translation happens outside your review.

The tutor is a *conversation*, so it uses the conversational register from
`docs/HINDI_STYLE.md` (तुम, everyday words) while keeping **NCERT maths vocabulary**
(भिन्न, पूर्णांक, समीकरण) so its words match the learner's textbook and exam.

Two rules: **mathematical notation stays universal** (`1/2`, `x + 3 = 7` — never
Devanagari numerals), and if the learner writes in the other language, follow
*them*, not the setting — a learner switching to English mid-conversation is
telling you something.

**Safety for minors.** The system prompt must refuse off-curriculum topics, never
request personal information, and never direct a learner off-platform. Learners are
11–14.

## Models

| Use | Model |
|---|---|
| Tutor conversation, hints, explanations | `claude-sonnet-5` |
| Parent summaries, batch/cron, classification | `claude-haiku-4-5-20251001` |

Load the `claude-api` skill before writing SDK calls — do not write the request
shape from memory.

## Context every tutor call carries

Assemble in `lib/ai/tutor.ts`, nothing more and nothing less:

0. **The learner's locale** — the tutor replies in their language (D16)
1. Learner's grade and current chapter/lesson title
2. The current lesson's `body_md` — the grounding text
3. Concept mastery for this chapter (which concepts are weak)
4. Last few `tutor_messages` turns for continuity
5. The learner's question

Don't dump the whole curriculum. Grounding is the current lesson plus mastery, which
keeps the call cheap enough to hit the D11 cost target.

## Prompts live in files

`lib/ai/prompts/*.ts`, exported as named template functions. Never inline a multi-
line system prompt at a call site — prompts are product surface and need to be
reviewable in a diff.

## Streaming

Tutor responses stream. First token under 2s p75 (D11). Show a thinking state
immediately on submit; a learner on 4G staring at a dead screen assumes it broke.

## Persist both turns

Write the user message and the assistant reply to `tutor_messages`. Then run the
struggle check (D6) — 4+ turns on one lesson with no practice attempt is one of the
three mentor-escalation triggers, and it can only be detected from persisted turns.

Emit `ai_question_asked` on every learner turn.

## Cost control

- Stream, don't poll.
- Cache the lesson grounding block across turns in a session.
- Haiku for anything batch — parent summaries are the main volume driver.
- Cap conversation history sent per call (last ~6 turns), not unbounded.

## When AI output is wrong

Fix it in this order — the first is the usual culprit:

1. **Grounding** — was the lesson text actually in the context? Log the assembled prompt and look.
2. **Prompt** — is the constraint stated explicitly, positively, and early?
3. **Model** — only after 1 and 2. Reaching for a bigger model to paper over missing grounding costs money and doesn't reliably work.

Never patch a bad AI answer by hardcoding a special case in the UI.
