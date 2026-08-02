# Dagar — Implementation Specs

One file per feature slice. **A spec is what you hand Claude Code, and what you check
the result against.**

## How a spec relates to everything else

```
DECISIONS.md   ── why we chose it        ─┐
DATA_MODEL.md  ── what the schema is      │  upstream — specs REFERENCE these,
SCREENS.md     ── what order screens go   │  never restate them
saathi-design  ── what it looks like     ─┘
                          │
                          ▼
              docs/specs/<slice>.md
              ── the API contract
              ── the acceptance criteria   ← how you know it's done
              ── the edge cases
                          │
                          ▼
                   BUILD_PLAN.md
                   ── when you build it
```

**Specs add only what has no home upstream.** If a spec restates the schema or a
colour, delete that part — duplicated facts go stale silently, and a stale spec is
worse than no spec.

If a spec and `DECISIONS.md` disagree, **`DECISIONS.md` wins.**

## Spec shape

Every file follows the same eight sections, in this order:

1. **Header** — build slice, decisions it implements, what it depends on
2. **User flow** — the path through, referencing `SCREENS.md`
3. **Data** — which tables it reads and writes (names only, not schema)
4. **API contract** — routes, payloads, status codes
5. **Components** — files to create and their responsibility
6. **Analytics** — which canonical events fire, and exactly when
7. **Acceptance criteria** — checkboxes. **The section that matters most to you**
8. **Edge cases** — what breaks, and what should happen instead

## The set

| Spec | Slice | Day | Status |
|---|---|---|---|
| `i18n.md` | 0.5 + cross-cutting | 0 | ✅ |
| `auth-onboarding.md` | 1.1, 1.1a | 1 | ✅ |
| `pwa-shell.md` | 1.1b | 1 | ✅ |
| `curriculum-dashboard.md` | 1.3 | 1 | ✅ |
| `micro-lesson.md` | 1.4 | 1 | ✅ |
| `guided-practice.md` | 2.1, 2.1b, 2.2 | 2 | ✅ |
| `ai-tutor.md` | 2.3 | 2 | ✅ |
| `chapter-quiz.md` | 2.4 | 2 | ✅ |
| `progress-streaks.md` | 2.5 | 2 | ✅ |
| `mentor-request.md` | 2.6 | 2 | ✅ |
| `parent-connect.md` | 3.1, 3.2, 3.3 | 3 | ⬜ written Fri night |
| `observability.md` | 3.4, 3.4b | 3 | ⬜ written Fri night |

Day 3 specs are deliberately written on Friday evening, once we know what actually
shipped on Days 1–2 and what the cut list has claimed.

## No `supabase-schema.sql` here — deliberately

`CLAUDE.md` makes migrations numbered and forward-only, so `supabase/migrations/`
is the single source of truth for schema. A second full-schema file would diverge
from it the first time a column is added, and nothing would catch the drift.

## Using a spec

```
Use the saathi-feature and saathi-design skills.
Build docs/specs/auth-onboarding.md. Every acceptance criterion must pass.
```

Then read the acceptance criteria yourself and tick them off against the running app.
That checklist is the deliverable — not the code.
