---
name: saathi-design
description: >
  Enforces the Saathi design system on every UI component, page, screen and style
  decision. Always apply this skill when writing any frontend code — components,
  layouts, pages, CSS, Tailwind classes, or inline styles. Trigger when the user asks
  to build a page, component, UI, screen, layout, or anything visual. Also trigger on
  "make it look right", "follow the design system", "use our colours", "style this",
  or any work on the learner or parent experience. Never use colours, spacing or type
  sizes that are not defined here.
---

## Design System: Saathi

An adaptive learning companion for **learners aged 11–14**, most on a **shared,
low-end Android phone**, many studying in a second language, many already behind
and low on confidence.

Every UI decision must communicate: **warmth, encouragement, clarity, progress, and
calm.** Never: punishment, ranking, pressure, or clutter.

Saathi means *companion*. The interface should feel like one sitting beside you —
not a test being administered to you.

---

## The five constraints that drive everything

1. **360px wide.** Design at 360 first. Anything wider is a bonus.
2. **Cheap LCD screens, often outdoors, often at low brightness** to save battery.
   Low-contrast grey-on-grey is invisible in these conditions. Contrast is a
   functional requirement, not a preference.
3. **The learner is already behind.** Nothing may read as failure, ranking, or
   scolding.
4. **Data costs money.** No heavy images, no video, no web fonts beyond one per script.
5. **One thing at a time.** Low information density — the opposite of a dashboard.

---

## Implementation notes (Tailwind 4)

Tokens live in `@theme` inside `app/globals.css`. **There is no `tailwind.config.ts`**
— Tailwind 4 is CSS-first.

> **The syntax trap:** referencing a CSS variable in an arbitrary value uses
> **parentheses**, not brackets.
>
> ```
> rounded-(--radius-control)   ✅  resolves to 10px
> rounded-[--radius-control]   ❌  silently computes to 0px
> ```
>
> The bracket form does not error, does not warn, and does not appear in the
> build output — it just renders square corners. Caught on Day 0 only by reading
> `getComputedStyle` in a browser. **If a token looks like it is being ignored,
> check the brackets first.**

There is also deliberately **no `prefers-color-scheme: dark` block**. Dark mode is
out of MVP scope, and the Next scaffold's default one would invert the app on any
phone set to dark mode, silently breaking every contrast ratio verified below.

### The `:lang()` trap — how the Devanagari scale is applied

`<html lang>` is set from the learner's locale, so **`:lang(hi)` matches the root
element**. Two consequences, both found on Day 0 by measuring in a browser:

> **Never put `font-size` on `:lang(hi)`.** It changes the rem base, and every
> `rem` token in `@theme` inflates 12.5% the moment a learner picks Hindi — the
> H1 rendered at 20px instead of 26px, and all spacing grew with it.
>
> Set the *token* instead, on `body`:
> ```css
> :lang(hi)      { font-family: var(--font-devanagari); }  /* script only */
> body:lang(hi)  { --text-body: 1.125rem; --text-body--line-height: 1.75; }
> ```
> Tailwind 4 utilities compile to `font-size: var(--text-body)`, so overriding the
> variable moves body copy to 18px/1.75 and leaves the heading scale alone.

> **`:lang()` matches by *inherited* language, so it hits the whole subtree**, and
> the rule is unlayered — it beats every Tailwind `text-*` utility inside it. Put
> only `font-family` and custom properties in a `:lang()` rule. A `line-height`
> there silently overrode `text-h3` on every nested element.

A Latin island inside a Hindi page — the `English` card in the language picker —
needs its own `:lang(en)` rule, or it inherits Noto Sans Devanagari. That font has
Latin glyphs, so the failure renders perfectly and is only visible in
`getComputedStyle`.

## Colours

Every value below is contrast-verified. Ratios are against white unless stated.

### Brand

| Token | Hex | Contrast | Use |
|---|---|---|---|
| Primary | `#0F766E` | 5.47:1 AA | Primary buttons, active nav, progress fill, links |
| Primary Strong | `#115E59` | 7.58:1 AAA | Hover/pressed, primary text on light teal |
| Primary Soft | `#CCFBF1` | — | Selected states, soft fills, badge backgrounds |
| Primary Wash | `#F0FDFA` | — | Section backgrounds, tutor assistant bubbles |

Teal, deliberately — it reads as calm and growth, it is not gendered, and it avoids
both the corporate blue every edtech competitor uses and saffron/green, which carry
political weight in India.

### Neutrals

| Token | Hex | Contrast | Use |
|---|---|---|---|
| Ink | `#1A2733` | 15.20:1 AAA | Headings, question text, body |
| Body | `#3F4A57` | 9.02:1 AAA | Secondary text, descriptions |
| Muted | `#5B6673` | 5.84:1 AA | Labels, helper text, timestamps |
| Border | `#D8DEE4` | — | Card borders, dividers |
| Border Strong | `#B6C0CA` | — | Input borders |
| Surface | `#F1F5F4` | — | Cards on tinted backgrounds, lesson body |
| Background | `#FFFFFF` | — | Page background |

**Muted (`#5B6673`) is the lightest text permitted anywhere.** Do not invent a
lighter grey for "subtle" text — on a dim outdoor screen it disappears.

### Feedback — the most important table here

| State | Hex | Contrast | Use |
|---|---|---|---|
| Correct | `#15803D` | 5.02:1 AA | Correct answers, completed lessons |
| Correct Soft | `#DCFCE7` | — | Correct answer background |
| Not Quite | `#B45309` | 5.02:1 AA | **Incorrect answers** |
| Not Quite Soft | `#FEF3C7` | — | Incorrect answer background |
| Hint | `#0369A1` | 6.44:1 AA | Hints, tips, "try this" |
| Error | `#B91C1C` | 6.47:1 AA | **System failures only** |

> **A wrong answer is amber, never red.** Red is reserved exclusively for genuine
> system errors — a failed network request, a lost connection. A learner who is
> already behind should never see the colour of danger because they mixed up a sign.
> Amber says *not yet*; red says *you failed*. This rule is not negotiable.

Never show a bare red ✗. Incorrect states pair amber with a next step: a hint, a
worked example, or an invitation to retry.

### Mastery bands (D5)

| Band | Hex | Label |
|---|---|---|
| Needs Revision | `#B45309` | "Keep practising" |
| Developing | `#0369A1` | "Getting there" |
| Mastered | `#15803D` | "Mastered" |

Use the friendly label in the UI, never the enum. `needs_revision` is a database
value, not copy.

### Celebration

| Token | Hex | Use |
|---|---|---|
| Celebrate | `#B45309` on `#FFFBEB` | Milestone toasts, streak flame (4.84:1 AA) |
| Streak Active | `#EA580C` | Flame icon when the streak is alive |
| Streak Rest | `#B6C0CA` | Flame icon when the streak is broken — grey, never red |

### Dark mode

**Out of scope for MVP.** Most target devices are LCD, so the battery argument does
not hold, and it doubles every contrast check. Use the tokens above only — do not
hardcode `bg-white`, so a later theme swap stays cheap.

---

## Typography

| Role | Family | Use |
|---|---|---|
| Primary (Latin) | `Inter, system-ui, sans-serif` | English UI and content |
| Primary (Devanagari) | `Noto Sans Devanagari` | Hindi UI and content — **MVP, not Phase 2** (D16) |
| Math | KaTeX default | Rendered math only |

Two families, one per script. Subset the Devanagari font and `font-display: swap`
— every font byte is data the learner pays for.

### Devanagari typography — three rules

Devanagari is not Latin at a different size. It renders taller, carries the
shirorekha (top bar) plus stacked matras, and needs room to breathe:

| | Latin | Devanagari |
|---|---|---|
| Body size | 17px | **18px** — 17px Devanagari reads visibly smaller |
| Body line-height | 1.6 | **1.75** — matras collide below 1.7 |
| Letter-spacing | default | **never negative** — it breaks conjuncts |

Numerals stay **Arabic** (`1/2`, not `१/२`). NCERT Hindi mathematics editions use
Arabic numerals, and KaTeX renders them regardless — do not localise digits.

Test every screen in **both** languages. Hindi strings run roughly 10–20% longer
than English; a button that fits "Continue" may not fit "आगे बढ़ें".

### Scale

| Token | Size | Weight | Use |
|---|---|---|---|
| H1 | 26px | 700 | Screen title |
| H2 | 21px | 600 | Section heading, chapter name |
| H3 | 18px | 600 | Card title, lesson title |
| **Body** | **17px** Latin / **18px** Devanagari | 400 | **Lesson text, question stems — the default** |
| Body Small | 15px | 400 | Secondary text, card descriptions |
| Label | 14px | 500 | Buttons, badges, nav |
| Caption | 13px | 400 | Timestamps, helper text — sparingly |
| Math | 19px | — | KaTeX inline and display |

**Body is 17px, not 14px.** A 14px baseline on a 360px screen is a genuine barrier
for a 12-year-old reading in their second language. Math renders two points larger
still, because a mis-read exponent is a wrong answer.

Line height **1.6 Latin / 1.75 Devanagari** for lesson body. Line length capped at ~62 characters.

---

## Spacing

4px grid. Only these values:

| Token | Value |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 12px |
| lg | 16px |
| xl | 24px |
| 2xl | 32px |
| 3xl | 48px |

Screen gutter is `lg` (16px) at 360px. Card padding is `lg`. Vertical rhythm
between blocks is `xl`.

---

## Layout

Single column. Always.

```
┌─────────────────────────┐
│  Header (56px)          │  back · title · streak
├─────────────────────────┤
│                         │
│  Content (scroll)       │  max-width 480px, centred
│                         │
├─────────────────────────┤
│  Bottom nav (64px)      │  Learn · Practise · Progress · Parent
└─────────────────────────┘
```

- Content max-width **480px**, centred on larger screens. Never stretch a lesson
  across a desktop viewport.
- Bottom nav for primary navigation — thumbs reach the bottom, not the top.
- Sticky primary action at the bottom of the content area on lesson and practice
  screens, above the nav.
- **Never a horizontal scroll.** Long math and tables scroll inside their own
  container.

---

## Components

### Buttons

| Variant | Background | Text | Use |
|---|---|---|---|
| Primary | `#0F766E` | `#FFFFFF` | Continue, Check answer, Start lesson |
| Secondary | `#CCFBF1` | `#115E59` | Skip, See hint, Try again |
| Ghost | transparent | `#3F4A57`, 1px `#D8DEE4` | Back, Cancel |
| Danger | `#B91C1C` | `#FFFFFF` | Destructive only — rare |

Height **48px**, radius `10px`, full-width on mobile for primary actions.
Minimum touch target 44×44px everywhere, including icon buttons.

### Cards

Background `#FFFFFF`, border `1px #D8DEE4`, radius `14px`, padding `16px`.
Shadow only on elevated surfaces (toasts, sheets): `0 2px 8px rgba(26,39,51,0.08)`.

### Chapter card

Title (H3) · concept count · progress bar · mastery badge. Tapping anywhere on the
card opens it — not a small "Open" link.

### Micro-lesson

Body at 17px/1.6 on `#FFFFFF`. Worked examples on `#F1F5F4` with a `#0F766E` left
border, 3px. Display math centred with vertical `lg` breathing room.

### AI Tutor chat

| Element | Style |
|---|---|
| Learner message | `#0F766E` bg, white text, right-aligned, radius 14px (4px bottom-right) |
| Tutor message | `#F0FDFA` bg, `#1A2733` text, left-aligned, radius 14px (4px bottom-left) |
| Thinking state | Three pulsing dots in `#5B6673` — visible immediately on send |

The thinking state is not optional. On 4G, a learner staring at an unchanged screen
assumes the app is broken.

### Practice question

Stem at 17px. Answer input 48px tall, radius 10px, border `#B6C0CA`, focus border
`#0F766E` with a 3px `#CCFBF1` ring.

Feedback states:

| State | Treatment |
|---|---|
| Correct | `#DCFCE7` bg, `#15803D` border and check, "Correct!" plus one line of why |
| Not quite | `#FEF3C7` bg, `#B45309` border, "Not quite — here's a hint" **plus the hint** |
| Hint shown | `#0369A1` left border on a `#F1F5F4` panel |

Never leave an incorrect state without a next step on screen.

### Progress

Ring or bar in `#0F766E` on a `#F1F5F4` track. Always pair the visual with a number
("3 of 5 lessons") — a ring alone is not readable to everyone.

### Streak

Flame icon plus day count, **always visible in the header** — Duolingo is right that
constant visibility is what makes a streak matter. Active `#EA580C`, broken `#B6C0CA`. A broken streak shows
"Start again today", never a loss message. Grace days (D7) show as a lighter flame,
not a gap.

### Daily goal ring (D17)

The strongest daily-return mechanic, and cheap. Top of the dashboard, above chapters.

- Ring in `#0F766E` on a `#F1F5F4` track, 72px, with the count inside.
- Goal is **one lesson or five practice questions** — the same rule that extends
  the streak (D7), so the ring and the flame never disagree.
- **Closable in one session.** A goal a struggling learner cannot finish on a bad
  day is a daily reminder that they failed.
- Complete state: ring fills, brief celebration, copy becomes "आज का काम पूरा!" /
  "Done for today!" — then it stops asking. No second goal, no upsell to more.

### In-lesson progress

Dots or a thin bar at the top of a micro-lesson showing step *n* of *m*. Duolingo's
most under-copied idea: a visible finish line is why people finish. Costs almost
nothing and measurably raises completion.

### Journey layout for chapters

Lay chapters and lessons out as a **path**, not a list — a vertical sequence of
nodes with a visible "you are here". Completed nodes filled `#0F766E`, current node
ringed and larger, upcoming nodes `#D8DEE4` outline.

Progress you can see beats a progress percentage. This is mostly CSS on data you
already have.

### Milestone toast

`#FFFBEB` bg, `#B45309` border and icon, badge name, auto-dismiss 4s, dismissible.
Respects `prefers-reduced-motion`.

### Language picker (D16)

Flow and routing for this screen are in `docs/SCREENS.md` Flow 1 — read it before
building onboarding. The **first screen a learner sees**, before grade selection. Get it wrong and a
Hindi-medium learner is locked out at the front door.

- **Each option is written in its own script** — `English` and `हिंदी`. Never
  "Hindi" in English, never "अंग्रेज़ी" in Hindi. A learner who cannot read English
  must still recognise their option instantly.
- **No flags.** Flags are countries, not languages, and Hindi has no flag.
- Full-width option cards, minimum 64px tall — larger than a normal 48px button,
  because this is the one tap that gates everything after it.
- Selected state: `#CCFBF1` fill with `#0F766E` border, plus a check icon —
  colour is never the only signal.
- **No text above the picker** that requires reading either language to understand.
  The Saathi wordmark is fine; a sentence of instructions is not.
- Reachable again from Settings, same component.

### Mentor request CTA

Inline card, `#F0FDFA` bg, `#0F766E` border. **Never a modal, never blocking.**
Always dismissible. Copy is an offer, not a diagnosis: "Want a person to explain
this?" — not "You are struggling."

---

## Icons

- Library: **Lucide React**
- Default size **20px**, stroke `1.75`
- Never icon-only for a primary action — pair with a label
- Every icon-only button needs an `aria-label`

---

## Motion

| Use | Duration | Easing |
|---|---|---|
| State change, hover, focus | 150ms | ease-out |
| Screen transition | 220ms | ease-out |
| Celebration (milestone, streak) | 400ms | ease-out |

Celebration animation is the **only** place motion may be playful, and it is capped
at 400ms. Everything else is fast and unobtrusive.

**Every animation must be wrapped in a `prefers-reduced-motion` check.** Some
neurodiverse learners — explicitly named in the PRD vision — are affected by motion.
Under reduced motion, celebrations become a static badge, not a removed feature.

---

## Voice and tone

The copy is part of the design system.

| Instead of | Write |
|---|---|
| "Incorrect" / "Wrong" | "Not quite — try this" |
| "You failed the quiz" | "Let's revise this chapter together" |
| "Streak lost" | "Start a new streak today" |
| "You are struggling with fractions" | "Fractions need a bit more practice" |
| "Error 500" | "Something went wrong on our side. Try again?" |

Hindi copy is written for a 12-year-old, not translated formally. Prefer everyday
spoken Hindi over textbook register: "फिर से कोशिश करें", not "पुनः प्रयास कीजिए".

Rules: second person ("you"), present tense, short sentences, no exclamation marks
except genuine celebration, never sarcasm, never comparison to other learners.

---

## Accessibility (D10 — in MVP scope)

- WCAG 2.1 **AA** minimum; body text targets AAA and mostly reaches it
- Full keyboard navigation, visible focus ring (3px `#CCFBF1` on `#0F766E`)
- Semantic HTML and correct landmarks
- Accessible name on every interactive element
- Touch targets ≥ 44×44px
- Text reflows at 200% zoom with no horizontal scroll
- `prefers-reduced-motion` honoured everywhere
- Colour is **never** the only signal — pair with an icon and text

---

## Rules

1. Never use a colour not defined in this file.
2. Never use spacing off the 4px grid.
3. **Wrong answers are amber. Red is for system errors only.**
4. Body text is 17px Latin / 18px Devanagari. Never ship 14px body copy.
5. `#5B6673` is the lightest text permitted. No lighter greys.
6. Every interactive target is ≥ 44×44px.
7. Design at 360px first. Content max-width 480px.
8. Never a horizontal scroll on the page body.
9. Every animation checks `prefers-reduced-motion`.
10. Colour is never the sole carrier of meaning.
11. Low information density — one thing at a time.
12. No leaderboards, ranks, or comparison between learners. Progress is personal.
    Also no hearts/lives, no XP, no guilt notifications — see `DECISIONS.md` D17 for
    why these Duolingo mechanics invert for a learner who is already behind.
13. Every screen is checked in **English and Hindi**. Hindi runs 10–20% longer — layouts must not break.
