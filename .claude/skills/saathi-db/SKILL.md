---
name: saathi-db
description: Write and apply Supabase migrations and RLS policies for Saathi. Use when adding or altering tables, columns, indexes, views, or database functions, when writing or debugging row-level security, or when a query returns empty rows that should exist (almost always an RLS problem). Trigger on "add a table", "migration", "RLS", "policy", "why is this query empty", "supabase db push".
---

# Saathi database changes

Schema and policy shape live in `docs/DATA_MODEL.md`. Read it before writing SQL —
the table you need may already be specified.

## Migration rules

- Numbered, forward-only, in `supabase/migrations/NNNN_description.sql`.
- **Never edit an applied migration.** Write a new one that alters.
- One concern per file. Identity, curriculum, learner state, and analytics stay separate.
- Every migration is idempotent where cheap (`if not exists`, `create or replace`).
- Update `docs/DATA_MODEL.md` in the same change. A schema doc that drifts is worse
  than no schema doc.

Apply with:

```bash
npx supabase db push
```

## RLS is not optional

Every table gets `alter table X enable row level security;` in the same migration
that creates it. A table without RLS on Supabase is world-readable through the anon
key — for a product serving minors, that is the failure that matters most.

The two policy shapes you'll write:

**Student owns their rows**
```sql
create policy "students manage own <thing>"
  on public.<table> for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
```

**Parent reads a linked student's rows** — this is the only cross-user path
```sql
create policy "parents read linked student <thing>"
  on public.<table> for select
  using (exists (
    select 1 from public.parent_links pl
    where pl.student_id = <table>.student_id
      and pl.parent_id = auth.uid()
      and pl.status = 'active'
  ));
```

There is no parent write policy anywhere. If you are writing one, re-read D2.

## Answer keys

`questions.answer_value` and `questions.solution_md` must not be selectable by
learners. Expose the `questions_public` view instead and grant on the view, not the
table. Grading reads the base table through the service-role client in a route
handler.

## Debugging "the query returns nothing"

In order, this is almost always:

1. RLS policy missing or mismatched → test the same query with the service role key. If it returns rows, it's RLS.
2. Querying as anon when you meant to be authenticated.
3. A join crossing a table whose policy doesn't allow the row.

Don't fix an RLS problem by moving the query to the service role. That removes the
boundary instead of fixing it.

## Derived state

`concept_mastery` and `streaks` are computed, not client-supplied. They update
through database functions (`0007_functions.sql`) or a service-role route handler
on attempt/lesson write. Formulas are in `DECISIONS.md` D5 and D7.

## Seeding

Curriculum seed lives in `supabase/seed/`, one file per chapter, loaded by
`npm run seed`. It is idempotent — upsert on slug, so re-running never duplicates.
Never put learner data in a seed.
