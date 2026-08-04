import { requireAdmin } from "@/lib/security/adminGuard";

/**
 * `/admin/metrics` — the shell. The numbers arrive in the next slice.
 *
 * Guarded twice on purpose: once in the layout, once here. `getCurrentUser` is
 * request-cached so the second call costs nothing, and it means this page keeps
 * its guard if it is ever moved.
 *
 * **English only, and not translated.** Every other screen in Dagar is checked
 * in both languages because a learner may read either. This one has exactly one
 * reader, and a `messages/` key that only ever renders in English is a key
 * somebody has to maintain for nobody.
 *
 * Spec: docs/ANALYTICS.md §6 (the CEO view), §7 (the product-lead view), §9
 * (these access rules).
 */
export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const email = await requireAdmin();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-xl flex flex-col gap-xl">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 text-ink">Metrics</h1>
        <p className="text-body-sm text-muted">Signed in as {email}</p>
      </header>

      <section className="flex flex-col gap-sm rounded-(--radius-card) border border-border bg-surface px-lg py-lg">
        <h2 className="text-h3 text-ink">Nothing here yet</h2>
        <p className="text-body-sm text-body">
          The events are recording. The aggregation layer and the charts are the
          next slice — see <code>docs/ANALYTICS.md</code> §11 for the order.
        </p>
      </section>

      {/*
        The rule this page is built under, stated on the page itself so it
        cannot quietly stop being true. See ANALYTICS.md §9.
      */}
      <section className="flex flex-col gap-sm rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg">
        <h2 className="text-h3 text-primary-strong">Counts only, never a learner</h2>
        <p className="text-body-sm text-body">
          Nothing on this page names an individual learner, and nothing will.
          No names, no email addresses, no per-learner rows, no drill-down —
          only totals and distributions. A page that lets an adult watch a named
          child&rsquo;s activity is surveillance whatever we call it.
        </p>
      </section>
    </main>
  );
}
