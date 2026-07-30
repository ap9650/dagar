---
name: saathi-ship
description: Pre-deploy verification and Vercel release for Saathi — secret leak check, RLS boundary check, accessibility pass, mobile check, env var sync, and deploy. Use before pushing to production, before a demo, or when asked to deploy, ship, release, or run a pre-flight check. Trigger on "deploy", "ship it", "push to vercel", "ready for demo", "pre-flight".
---

# Ship Saathi

Run every gate. On a product handling minors' data with a live demo at the end, the
expensive failures are all in gates 1–3.

## Gate 1 — Secrets

No secret may reach the browser bundle.

```bash
grep -rn "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" app lib components
```

`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_*` must never appear with
that prefix. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
belong there.

```bash
grep -rn "supabase/admin" --include="*.tsx" app components
```

Any hit in a client component is a service-role key in the browser — stop and fix
before anything else.

Confirm `.env.local` is gitignored and no key is committed.

## Gate 2 — RLS boundaries

Verify by attempting the violation, not by reading the policy:

- Log in as student A, try to read student B's `attempts` → must return empty.
- Log in as a parent, try to **write** any learner row → must fail.
- Log in as a parent not linked to student A, read A's progress → must return empty.
- Query `questions` as an authenticated learner → `answer_value` must not be exposed.

A policy that reads correctly but wasn't exercised is untested.

## Gate 3 — Accessibility (D10, in scope for MVP)

- Tab through every screen: everything reachable, focus always visible.
- No keyboard trap; modals return focus on close.
- Every icon-only button has an accessible name.
- AA contrast on all text, including on coloured backgrounds and disabled states.
- Touch targets ≥ 44×44px.
- Text at 200% zoom: reflows, no horizontal scroll.
- `prefers-reduced-motion` honoured on streak/celebration animations.
- Images and math have text alternatives.

## Gate 4 — Mobile

Test at **360px** — that's the real device, not an edge case.

- No horizontal scroll anywhere.
- Tutor input isn't covered by the on-screen keyboard.
- KaTeX blocks scroll inside their container rather than breaking layout.
- Throttle to Fast 3G and confirm loading states actually appear and read sensibly.

## Gate 5 — Build

```bash
npm run typecheck && npm run lint && npm run build
```

All three clean. No `@ts-expect-error` added to get past this gate.

## Gate 6 — Migrations and env

- All migrations applied to the production Supabase project (`npx supabase db push`).
- Seed loaded and verified: three chapters visible, questions present per concept.
- Every env var in `.env.local` also set in the **Vercel project settings** — a
  missing `ANTHROPIC_API_KEY` in Vercel is the classic "works locally, tutor dead in
  demo" failure.
- Vercel cron for the weekly parent summary is configured in `vercel.json`.

## Gate 7 — Deploy

```bash
vercel --prod
```

Then walk the full learner journey **on the deployed URL from a real phone**:
sign up → dashboard → lesson → tutor question → practice → quiz → progress →
parent link → parent view.

## Demo readiness

- Seeded demo accounts exist with realistic partial progress — a streak of 4, one
  chapter part-done, some concepts weak. An empty app demos badly.
- Parent's WhatsApp sandbox `join` was sent **today**. The sandbox session expires
  3 days after joining and free-form sends need the 24h reply window (D4) — a phone
  that joined earlier in the week fails silently. Re-join immediately before demoing,
  and keep the in-app `/parent` view open as the fallback.
- A mentor-request trigger is reachable in under 30 seconds of clicking.
- Know the fallback if wifi dies or the AI call times out.

Report honestly which gates passed and which you skipped. "Deployed" without gates
1–3 is not deployed, it's exposed.
