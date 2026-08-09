import Link from "next/link";
import { requireAdmin } from "@/lib/security/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MentorContext } from "@/lib/learning/mentorContext";
import { AcknowledgeButton } from "@/components/admin/AcknowledgeButton";

/**
 * The mentor request queue.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT A PANEL ON /admin/metrics.
 *
 * That page ends with a promise, printed on itself so it cannot quietly stop
 * being true: counts only, never a learner, no names and no drill-down, because
 * a page that lets an adult watch a named child's activity is surveillance
 * whatever we call it.
 *
 * Answering a request for help requires knowing exactly which child asked. So
 * this cannot live there without breaking that promise, and the promise is
 * worth more than the convenience.
 *
 * The difference is purpose. Metrics exists to understand a cohort and needs no
 * individual. This exists because a specific learner got three questions wrong,
 * was offered a person, and said yes. Identifying her IS the point, it is the
 * only reason the row was written, and it is the narrowest possible use.
 *
 * ── WHY IT HAD TO EXIST AT ALL ──────────────────────────────────────────────
 * `mentor_requests` is capture-only by design (D8): there is no mentor-side
 * app and status moves by hand. What nobody noticed is that nothing surfaced
 * the table either. A learner asked for help on 8 August and the request sat
 * unread for two days, because the only way to see it was a service-role query.
 *
 * "We record the request" is only honest if somebody can read it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TRIGGER_LABELS: Record<string, string> = {
  three_consecutive_incorrect: "Three wrong in a row",
  hints_exhausted_twice: "Ran out of hints twice",
  tutor_turns_no_practice: "Long tutor chat, no practice",
};

/**
 * Fetch and annotate, OUTSIDE the component.
 *
 * `Date.now()` is an impure call and react-hooks/purity rightly refuses it
 * during render: a component that reads the clock renders differently on every
 * pass. Reading it here, once, before anything renders, is the same information
 * with none of the ambiguity.
 */
async function loadRequests() {
  const admin = createAdminClient();
  const { data: requests, error } = await admin
    .from("mentor_requests")
    .select("id, student_id, trigger, learner_note, context, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    // Loud, like the metrics loader. An empty queue that means "the query
    // failed" would read as "nobody needs help", which is the one wrong answer.
    throw new Error(`Could not read mentor requests: ${error.message}`);
  }

  const rows = requests ?? [];
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const { data: profiles } = studentIds.length
    ? await admin.from("profiles").select("id, display_name, grade, locale").in("id", studentIds)
    : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  const annotate = (row: (typeof rows)[number]) => ({
    ...row,
    profile: who.get(row.student_id),
    when: new Date(row.created_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
    age: Math.floor((now - new Date(row.created_at).getTime()) / 86_400_000),
  });

  return {
    open: rows.filter((r) => r.status === "open").map(annotate),
    rest: rows.filter((r) => r.status !== "open").map(annotate),
  };
}

export default async function RequestsPage() {
  await requireAdmin();
  const { open, rest } = await loadRequests();

  return (
    <main className="flex-1 w-full max-w-[720px] mx-auto px-lg py-xl flex flex-col gap-2xl">
      <header className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <h1 className="text-h1 text-ink">Requests for a person</h1>
          <p className="text-body-sm text-body">
            A learner reached the point of being stuck, was offered a human, and
            said yes. There is no mentor service yet, so answering one means
            telling their teacher.
          </p>
        </div>
        <Link
          href="/admin/metrics"
          className="text-label text-primary-strong underline underline-offset-4 min-h-11 inline-flex items-center"
        >
          Metrics
        </Link>
      </header>

      <section className="flex flex-col gap-md">
        <h2 className="text-h2 text-ink">
          Open{open.length > 0 && <span className="text-celebrate"> · {open.length}</span>}
        </h2>

        {open.length === 0 ? (
          <p className="text-body-sm text-muted">
            Nothing waiting. Every request has been picked up.
          </p>
        ) : (
          <ul className="flex flex-col gap-lg list-none m-0 p-0">
            {open.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </ul>
        )}
      </section>

      {rest.length > 0 && (
        <section className="flex flex-col gap-md">
          <h2 className="text-h2 text-ink">Already picked up</h2>
          <ul className="flex flex-col gap-md list-none m-0 p-0">
            {rest.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap gap-sm items-baseline rounded-(--radius-card) border border-border px-lg py-md"
              >
                <span className="text-body-sm text-ink font-medium">
                  {request.profile?.display_name ?? "A learner"}
                </span>
                <span className="text-caption text-muted">
                  {TRIGGER_LABELS[request.trigger] ?? request.trigger}
                </span>
                <span className="text-caption text-muted ml-auto">
                  {request.when} · {request.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-sm rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg">
        <h2 className="text-h3 text-primary-strong">Why this page names children</h2>
        <p className="text-body-sm text-body">
          Every other admin screen is counts only. This one is not, because a
          request for help cannot be answered anonymously. It shows the least
          that makes answering possible: the name the learner chose, their
          class, what they were stuck on, and what they typed. No email address,
          no phone number, no browsing history, and no way to watch a learner
          who has not asked for anything.
        </p>
      </section>
    </main>
  );
}

type AnnotatedRequest = Awaited<ReturnType<typeof loadRequests>>["open"][number];

function RequestCard({ request }: { request: AnnotatedRequest }) {
  const { profile, when, age } = request;
  // `context` is jsonb: Postgres may legally return a string, a number or null.
  // Narrow at the boundary rather than trusting the type, the same way the
  // diary does, so one malformed row cannot take the queue down.
  const context =
    typeof request.context === "object" && request.context !== null && !Array.isArray(request.context)
      ? (request.context as Partial<MentorContext>)
      : null;

  const attempts = Array.isArray(context?.recent_attempts) ? context.recent_attempts : [];

  return (
    <li className="flex flex-col gap-md rounded-(--radius-card) border border-celebrate bg-celebrate-bg px-lg py-lg">
      <div className="flex flex-wrap gap-sm items-baseline">
        <span className="text-h3 text-ink">{profile?.display_name ?? "A learner"}</span>
        {profile?.grade && (
          <span className="text-caption text-muted">Class {profile.grade}</span>
        )}
        {profile?.locale && (
          <span className="text-caption text-muted">
            {profile.locale === "hi" ? "Hindi" : "English"}
          </span>
        )}
        <span className="text-caption text-celebrate font-medium ml-auto">
          {age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-sm m-0 text-body-sm">
        <div>
          <dt className="text-caption text-muted">What triggered it</dt>
          <dd className="text-ink m-0">{TRIGGER_LABELS[request.trigger] ?? request.trigger}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted">Stuck on</dt>
          <dd className="text-ink m-0">
            {context?.concept?.name ?? "Not recorded"}
            {context?.chapter?.title ? ` · ${context.chapter.title}` : ""}
          </dd>
        </div>
      </dl>

      {request.learner_note && (
        <blockquote className="m-0 rounded-(--radius-control) bg-background px-md py-sm">
          <p className="text-body text-ink m-0">{request.learner_note}</p>
        </blockquote>
      )}

      {attempts.length > 0 && (
        <details className="text-body-sm">
          <summary className="text-label text-primary-strong cursor-pointer min-h-11 flex items-center">
            What they were getting wrong ({attempts.length})
          </summary>
          <ul className="flex flex-col gap-xs list-none m-0 mt-sm p-0">
            {attempts.map((attempt, i) => (
              <li key={i} className="flex gap-sm items-baseline">
                <span
                  aria-hidden
                  className={attempt.is_correct ? "text-correct" : "text-celebrate"}
                >
                  {attempt.is_correct ? "✓" : "~"}
                </span>
                <span className="text-body">
                  {attempt.given_answer_label ?? attempt.given_answer}
                </span>
                {attempt.hints_used > 0 && (
                  <span className="text-caption text-muted">
                    {attempt.hints_used} hint{attempt.hints_used === 1 ? "" : "s"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-md items-center">
        <AcknowledgeButton id={request.id} />
        <span className="text-caption text-muted">Asked {when}</span>
      </div>
    </li>
  );
}
