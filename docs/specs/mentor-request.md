# Spec: Struggle Detection & Mentor Request

**Build slice:** 2.6
**Implements:** D6 (triggers), D8 (capture only, no mentor UI), D8a (it says so)
**Depends on:** attempts (2.2) · tutor (2.3)
**Design:** `saathi-design` → mentor CTA (always dismissible)

---

## 1. What this is, and what it is not

The app notices a learner is stuck and **asks whether they want** a human. It
captures the request with full context. **There is no mentor-side UI in MVP**
(D8) — requests are reviewed manually, and nothing notifies anyone that one has
arrived.

**The copy must not promise a mentor** (D8a). It said "we can pass this on to a
mentor" and "a person reads these, so it can take a day or two" until 3 Aug;
neither was true, and the second was specific enough for a stuck learner to wait
on. It now states that the thing is not built and that asking is what tells us to
build it. **If a mentor console ever ships, this copy changes back — and not
before.**

Being honest about that in the demo is a strength: the detection and the context
capture are the hard parts, and they are real.

---

## 2. Triggers (D6)

Surface the CTA when **any** of:

1. 3 consecutive incorrect attempts on the same concept
2. 2 attempts on the same concept where all hints were exhausted
3. ≥4 AI Tutor turns on one lesson with no practice attempt started

Evaluated server-side, after each attempt (1, 2) and after each tutor turn (3).

> **The CTA is a suggestion, never a modal and never a block.** A learner who is
> already struggling must not also be interrupted. It can always be dismissed.

---

## 3. Context captured

The whole value of this feature. `mentor_requests.context` holds:

- The concept and chapter
- The last 3–5 attempts with the given answers
- An excerpt of the tutor conversation
- Which D6 trigger fired
- The learner's own note, if they wrote one

A mentor should be able to help **without asking the learner to re-explain anything.**

---

## 4. API contract

| Route | Behaviour |
|---|---|
| `POST /api/mentor-requests` | Zod `{ concept_id, trigger, learner_note? }`. Assembles context server-side — **never trust a client-supplied transcript**. Writes `mentor_requests` with `status: "open"`. Emits `mentor_request_submitted`. Rate-limited per learner. |

Status enum `open → acknowledged → resolved` is changed manually in MVP.

---

## 5. Analytics

`mentor_request_submitted` with `{ concept_id, trigger }` — only when the learner
**accepts**. Showing or dismissing the CTA emits nothing (off the canonical list).

Requests clustering on one concept usually mean a badly written lesson, not a hard
concept. Check the lesson first (`saathi-observe`).

---

## 6. Acceptance criteria

**Triggers**
- [ ] 3 consecutive wrong attempts on one concept surfaces the CTA
- [ ] 2 attempts with hints exhausted on one concept surfaces it
- [ ] 4 tutor turns on a lesson with no practice attempt surfaces it
- [ ] Wrong answers spread across **different** concepts do not trigger it
- [ ] A correct answer resets the consecutive-wrong counter
- [ ] Triggers are evaluated server-side; a client cannot fabricate one

**Behaviour**
- [ ] The CTA is inline and dismissible — never a modal, never blocking
- [ ] Dismissing it lets the learner continue immediately
- [ ] It does not immediately reappear after dismissal in the same session
- [ ] Copy is an offer, not a diagnosis: "Want a person to explain this?" — never "You are struggling"

**Capture**
- [ ] A submitted request contains concept, chapter, last 3–5 attempts, tutor excerpt, and which trigger fired
- [ ] The context is assembled server-side; a forged client payload does not alter what is stored
- [ ] The learner sees a clear confirmation, with honest expectations about response time
- [ ] `mentor_request_submitted` fires only on accept

**Boundary**
- [ ] A learner can read only their own requests; RLS denies another learner's
- [ ] A linked parent can read but not write them
- [ ] No mentor-facing route exists in MVP

**Accessibility & language**
- [ ] The CTA and its dismiss control are keyboard reachable, both ≥44px
- [ ] The CTA is not styled as an error or a warning — it is an offer
- [ ] All copy renders in the learner's locale, in the conversational register (`HINDI_STYLE.md`)

---

## 7. Edge cases

| Case | Required behaviour |
|---|---|
| **Two triggers fire at once** | One CTA, one request. Record the first trigger that fired. |
| **Learner submits repeatedly** | Rate-limit per learner per concept. Do not create duplicate open requests for the same concept — update the existing one. |
| **Learner dismisses every time** | Respect it. Do not escalate the prompt, do not make it harder to dismiss. Dismissal is data (they do not want a mentor), not a failure to convert. |
| **Trigger fires but no tutor conversation exists** | Context includes attempts only. Never block submission on a missing excerpt. |
| **Struggle detected during a quiz** | Do not interrupt a quiz. Surface the CTA on the **results** screen instead. |
| **Learner writes something concerning in the note** | Store it, confirm warmly, and flag it for manual review. Never have the AI respond to it — this path is deliberately human. |
| **Concept has no lesson yet** | Still capture. The request is about the learner's need, not content availability. |
