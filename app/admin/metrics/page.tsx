import Link from "next/link";
import { requireAdmin } from "@/lib/security/adminGuard";
import { loadMetrics, type Metrics } from "@/lib/analytics/dashboard";
import { percent, BarList, DailyLine, FunnelBars, LocaleFunnel, Stat } from "@/components/admin/charts";
import { Glossary } from "@/components/admin/Glossary";
import type { MetricWindow } from "@/lib/analytics/metrics";

/**
 * `/admin/metrics` — the whole dashboard.
 *
 * Spec: `docs/ANALYTICS.md`. §6 is everything above "The detail", §7 is
 * everything below it, §8 is the glossary, §9 is why the guard is here.
 *
 * ── ONE PAGE, TWO READERS ───────────────────────────────────────────────────
 * The top six numbers must be quotable without a caveat — if a figure needs an
 * asterisk to be honest, the asterisk goes next to it or the figure belongs
 * further down. Everything below answers "what exactly is broken, and where".
 * That ordering is the design, not an accident of what was easy to compute.
 *
 * **English only, and not translated.** Every other screen is checked in both
 * languages because a learner may read either. This one has one reader, and a
 * message key that only ever renders in English is maintenance for nobody.
 */
export const dynamic = "force-dynamic";

const WINDOWS: { key: MetricWindow; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "week", label: "This week" },
  { key: "today", label: "Today" },
];

const STAGE_LABELS: Record<string, string> = {
  opened_app: "Opened the app",
  reached_signin: "Reached sign-in",
  got_account: "Got an account",
  picked_class: "Picked a class",
  opened_lesson: "Opened a lesson",
  finished_lesson: "Finished a lesson",
  finished_chapter: "Finished a chapter",
};

const TARGET_LABELS: Record<string, string> = {
  first_lesson: "First lesson finished",
  lesson_completion: "Lesson completion",
  tutor_adoption: "Tutor adoption",
  practice_completion: "Practice completion",
  recommendation_acceptance: "Recommendation accepted",
  day7_retention: "Day-7 retention",
  parent_summary_open: "Parent summary opened",
};

const LOCALE_NAMES: Record<string, string> = { en: "English", hi: "हिंदी" };

const EXIT_LABELS: Record<string, string> = {
  too_hard: "It was too hard",
  too_easy: "It was too easy",
  confusing: "Could not work out how to use it",
  not_useful: "It did not help",
  duplicate: "Made another account by mistake",
  other: "Something else",
};

const TRIGGER_LABELS: Record<string, string> = {
  three_consecutive_incorrect: "Three wrong in a row",
  hints_exhausted_twice: "Ran out of hints twice",
  tutor_turns_no_practice: "Long tutor chat, no practice",
};

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  // The guard's return value is deliberately discarded. Showing "signed in as
  // <you>" was the obvious header and it is a small liability: this page gets
  // screenshotted for decks, and an address on it travels with the picture.
  // Nothing here needs to know who is reading, so nothing here is told.
  await requireAdmin();

  const requested = (await searchParams).window;
  const window: MetricWindow =
    requested === "week" || requested === "today" ? requested : "all";

  const m = await loadMetrics(window);
  const { headline: h } = m;

  const generated = new Date(m.generatedAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    // Wider than the 480px learner container on purpose: this is not a lesson,
    // it is a page of tables read on a laptop as often as a phone. It is still
    // designed at 360px first — nothing below scrolls sideways.
    <main className="flex-1 w-full max-w-[720px] mx-auto px-lg py-xl flex flex-col gap-2xl">
      <header className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <h1 className="text-h1 text-ink">Metrics</h1>
          <p className="text-caption text-muted">{generated} IST</p>
        </div>

        {/* The queue lives on its own page because this one promises never to
            name a learner, and answering a request for help cannot be done
            anonymously. A link, so the promise costs nothing in discoverability. */}
        <Link
          href="/admin/requests"
          className="text-label text-primary-strong underline underline-offset-4 min-h-11 inline-flex items-center"
        >
          Requests for a person
        </Link>

        <nav aria-label="Time range" className="flex gap-sm">
          {WINDOWS.map((option) => {
            const active = option.key === window;
            return (
              <Link
                key={option.key}
                href={`/admin/metrics?window=${option.key}`}
                aria-current={active ? "page" : undefined}
                className={`min-h-11 inline-flex items-center px-lg rounded-(--radius-control) text-label border ${
                  active
                    ? "border-primary bg-primary-soft text-primary-strong"
                    : "border-border text-body"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>

        {window !== "all" && (
          <p className="text-caption text-muted">
            Follows the learners who joined in this period, so a rate can never
            go above 100%. See “This week / Today” below.
          </p>
        )}
      </header>

      {/* ── §6 THE CEO VIEW ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-md">
        <div className="grid grid-cols-2 gap-md">
          <Stat label="Learners" value={String(h.learners)} note="picked a class" tone="primary" />
          <Stat
            label="Activated"
            value={h.learners ? percent(h.activatedShare) : "—"}
            note={`${h.activated} finished a first lesson`}
            tone="primary"
          />
          <Stat
            label="Still coming back"
            value={h.learners ? percent(h.returningShare) : "—"}
            note={`${h.returning} on two or more days`}
          />
          <Stat
            label="Lessons finished"
            value={String(h.lessonsFinished)}
            note={`across ${m.chapters.filter((c) => c.lessonsCompleted > 0).length} chapters`}
          />
          <Stat
            label="Chapters finished"
            value={String(h.chaptersFinished)}
            note={`by ${h.chaptersFinishedBy} ${h.chaptersFinishedBy === 1 ? "learner" : "learners"}`}
          />
          <Stat
            label="Asked for a human"
            value={String(h.mentorAsked)}
            note={`out of ${h.mentorOffered} times offered`}
          />
        </div>

        <div className="flex flex-col gap-sm rounded-(--radius-card) border border-border bg-background px-lg py-md">
          <h2 className="text-h3 text-ink">Active learners, last 14 days</h2>
          <DailyLine series={m.daily} />
        </div>
      </section>

      {/* ── §6 against the PRD targets ────────────────────────────────────── */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h2 text-ink">Against our targets</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="text-start">
                <th className="text-start font-medium text-muted text-caption pb-sm">Metric</th>
                <th className="text-end font-medium text-muted text-caption pb-sm">Now</th>
                <th className="text-end font-medium text-muted text-caption pb-sm">Target</th>
              </tr>
            </thead>
            <tbody>
              {m.targets.map((target) => {
                const met = target.value !== null && target.value >= target.target;
                return (
                  <tr key={target.key} className="border-t border-border">
                    <td className="py-sm text-ink">{TARGET_LABELS[target.key] ?? target.key}</td>
                    <td
                      className={`py-sm text-end tabular-nums ${
                        target.value === null
                          ? "text-muted"
                          : met
                            ? "text-correct"
                            : // Amber, never red. A target not yet met is "not
                              // yet", and red is for system errors only.
                              "text-notquite"
                      }`}
                    >
                      {percent(target.value)}
                      {target.value !== null && (
                        <span className="ms-xs" aria-hidden>
                          {met ? "✓" : "·"}
                        </span>
                      )}
                    </td>
                    <td className="py-sm text-end text-muted tabular-nums">
                      {percent(target.target)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-muted">
          An em dash means there is nothing to divide yet — not zero.
        </p>
      </section>

      <hr className="border-border" />

      <h2 className="text-h2 text-ink">The detail</h2>

      {/* ── §7A the funnel ───────────────────────────────────────────────── */}
      <Panel title="Where we lose people">
        <FunnelBars
          stages={m.funnel}
          labels={STAGE_LABELS}
          boundaryNote="Below this line the numbers are PEOPLE. Above it they are screen opens — we record nothing that identifies anyone before they have an account, so a reload counts twice. The top two carry no percentage on purpose: they are two separate counters, not steps. Sign-in can be opened directly, without the first screen, so it can legitimately be the larger number."
        />
      </Panel>

      {/* ── §7B onboarding ───────────────────────────────────────────────── */}
      <Panel title="Who signed up">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <h3 className="text-h3 text-ink">By class</h3>
            <BarList
              rows={Object.entries(m.byGrade)
                .sort()
                .map(([grade, count]) => ({
                  key: grade,
                  label: grade === "unknown" ? "Not recorded" : `Class ${grade}`,
                  value: count,
                }))}
              emptyLabel="Nobody has picked a class yet."
            />
          </div>
          <div className="flex flex-col gap-sm">
            <h3 className="text-h3 text-ink">By language</h3>
            <BarList
              rows={Object.entries(m.byLocale)
                .sort()
                .map(([locale, count]) => ({
                  key: locale,
                  label: LOCALE_NAMES[locale] ?? locale,
                  value: count,
                }))}
              emptyLabel="Nobody has picked a class yet."
            />
          </div>
        </div>
      </Panel>

      {/* ── §7C content ──────────────────────────────────────────────────── */}
      <Panel title="Which chapters get used">
        <div className="flex flex-col gap-lg">
          {m.chapters.map((chapter) => (
            <div key={chapter.chapterId} className="flex flex-col gap-sm">
              <div className="flex items-baseline justify-between gap-md">
                <h3 className="text-h3 text-ink">
                  Class {chapter.grade} · {chapter.title}
                </h3>
                <span className="text-body-sm text-body tabular-nums shrink-0">
                  {chapter.reached} reached
                </span>
              </div>

              <BarList
                rows={chapter.lessons.map((lesson) => ({
                  key: lesson.lessonId,
                  label: lesson.title,
                  value: lesson.completed,
                }))}
                emptyLabel="No lessons seeded."
              />

              <p className="text-caption text-muted">
                {chapter.lessonsCompleted}{" "}
                {chapter.lessonsCompleted === 1 ? "lesson" : "lessons"} finished ·{" "}
                {chapter.chaptersCompleted} finished the chapter
                {/*
                  Only when at least two learners stopped at the same place.
                  One person stopping is not a pattern, and "most stop after X"
                  off a single learner is the page inventing a finding — the
                  exact thing a drop-off statistic is easiest to get wrong at.
                  The count is named rather than implied, so the claim is
                  checkable at any cohort size.
                */}
                {chapter.dropOff && chapter.dropOff.drop >= 2 && (
                  <>
                    {" · "}
                    <span className="text-notquite">
                      {chapter.dropOff.drop} stopped after “{chapter.dropOff.title}”
                    </span>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── §7E retention ────────────────────────────────────────────────── */}
      <Panel title="Do they come back">
        <BarList
          rows={Object.entries(m.activeDays).map(([bucket, count]) => ({
            key: bucket,
            label: bucket === "1" ? "One day only" : `${bucket} days`,
            value: count,
          }))}
          emptyLabel="No activity yet."
        />
        <p className="text-caption text-muted">
          Distinct days each learner was active, Indian time. Buckets rather than
          an average — six learners on one day and one on fourteen is a
          different product from a flat two.
        </p>
      </Panel>

      {/* ── §7F language ─────────────────────────────────────────────────── */}
      <Panel title="Does Hindi hold up">
        <LocaleFunnel
          byLocale={m.localeFunnel}
          labels={STAGE_LABELS}
          localeNames={LOCALE_NAMES}
        />
        <p className="text-caption text-muted">
          Each language is scaled to its own first stage, so this shows where
          each group falls away rather than which group is bigger. A language
          dropping out one stage earlier is the most important thing this page
          can find.
          {Object.keys(m.localeSwitchedTo).length > 0 && (
            <>
              {" "}
              Switched language later:{" "}
              {Object.entries(m.localeSwitchedTo)
                .map(([locale, count]) => `${count} to ${LOCALE_NAMES[locale] ?? locale}`)
                .join(", ")}
              .
            </>
          )}
        </p>
      </Panel>

      {/* ── §7H demand and feedback ──────────────────────────────────────── */}
      <Panel title="What they are telling us">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <h3 className="text-h3 text-ink">Asked for a human</h3>
            <p className="text-body-sm text-body">
              {m.mentor.acted} of {m.mentor.shown} offers · {percent(m.mentor.rate)}
            </p>
            <BarList
              rows={Object.entries(m.mentor.byTrigger).map(([trigger, count]) => ({
                key: trigger,
                label: TRIGGER_LABELS[trigger] ?? trigger,
                value: count,
              }))}
              emptyLabel="Nobody has asked yet."
            />
          </div>

          <div className="flex flex-col gap-sm">
            <h3 className="text-h3 text-ink">Feedback</h3>
            <p className="text-body-sm text-body">
              {m.feedback.acted} of {m.feedback.shown} asked · {percent(m.feedback.rate)}
            </p>
            <BarList
              rows={Object.entries(m.feedback.understood).map(([answer, count]) => ({
                key: answer,
                label: `Understood it: ${answer.replace("_", " ")}`,
                value: count,
              }))}
              emptyLabel="No feedback yet."
            />
            {m.feedback.answers > m.feedback.acted && (
              <p className="text-caption text-muted">
                {m.feedback.answers} answers on file. The rate above only counts
                from 4 Aug 2026, when we started recording who was asked — the
                answers themselves go back further.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-sm">
            <h3 className="text-h3 text-ink">Why people left</h3>
            <BarList
              tone="amber"
              rows={Object.entries(m.exitReasons).map(([reason, count]) => ({
                key: reason,
                label: EXIT_LABELS[reason] ?? reason,
                value: count,
              }))}
              emptyLabel="Nobody has deleted their account."
            />
            <p className="text-caption text-muted">
              Recorded after the account is already gone, with no learner column
              on the table at all — so this is anonymous by construction, not by
              our restraint. It is also the one section here that is always all
              time: with nothing identifying on the row, there is no cohort to
              narrow it to.
            </p>
          </div>

          <div className="flex flex-col gap-sm">
            <h3 className="text-h3 text-ink">The parent loop</h3>
            <BarList
              rows={[
                { key: "invited", label: "Made an invite", value: m.parents.invited },
                { key: "linked", label: "A parent linked", value: m.parents.linked },
                { key: "sent", label: "Summaries sent", value: m.parents.summariesSent },
                { key: "viewed", label: "Summaries opened", value: m.parents.summariesViewed },
              ]}
            />
          </div>
        </div>
      </Panel>

      <hr className="border-border" />

      {/* ── what the AI cost ─────────────────────────────────────────────── */}
      <SpendPanel spend={m.spend} />

      <hr className="border-border" />

      {/* ── §8 the glossary ──────────────────────────────────────────────── */}
      <Glossary />

      {/* ── §9, said on the page so it cannot quietly stop being true ────── */}
      <section className="flex flex-col gap-sm rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg">
        <h2 className="text-h3 text-primary-strong">Counts only, never a learner</h2>
        <p className="text-body-sm text-body">
          Nothing on this page names an individual learner, and nothing will. No
          names, no email addresses, no per-learner rows, no drill-down — only
          totals and distributions. A page that lets an adult watch a named
          child&rsquo;s activity is surveillance whatever we call it.
        </p>
      </section>
    </main>
  );
}

/**
 * What the AI cost, and whether the unit economics still hold.
 *
 * ── WHY THIS EARNS A PANEL ──────────────────────────────────────────────────
 * D17 prices institutions at ₹450 because an active learner costs about ₹370,
 * and roughly ₹330 of that is this column. The pitch deck quotes it, the price
 * floor rests on it, and until now it was visible only to somebody willing to
 * query the database with a service-role key. A number that important should
 * not need an engineer to read it.
 *
 * Unwindowed, unlike the rest of the page: the floor is a lifetime cost per
 * learner, and one week of it is a different number wearing the same label.
 */
function SpendPanel({ spend }: { spend: Metrics["spend"] }) {
  const rupees = (value: number, dp = 2) =>
    `₹${value.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

  const ceilingPct = Math.min(100, (spend.todayInr / spend.ceilingInr) * 100);
  // Amber, never red. Approaching a budget is not a system error, and this page
  // follows the same colour rule as everything a learner sees.
  const nearCeiling = spend.todayInr >= spend.ceilingInr * 0.8;

  return (
    <Panel title="What the AI cost">
      <p className="text-body-sm text-body">
        Every model call writes its own cost. This is the number the ₹370 floor
        and the ₹450 institutional price are built on.
      </p>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-md m-0">
        {[
          ["Spent so far", rupees(spend.totalInr), `${spend.calls} calls`],
          ["Per learner", rupees(spend.perLearnerInr), `${spend.learners} learners`],
          [
            "Per tutor exchange",
            spend.perTutorExchangeInr === null ? "—" : rupees(spend.perTutorExchangeInr, 3),
            "target ₹0.44",
          ],
          ["Today", rupees(spend.todayInr), `ceiling ${rupees(spend.ceilingInr, 0)}`],
        ].map(([label, value, sub]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-caption text-muted">{label}</dt>
            <dd className="text-h3 text-ink m-0">{value}</dd>
            <p className="text-caption text-muted m-0">{sub}</p>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-xs">
        <div
          className="h-2 w-full rounded-full bg-surface overflow-hidden"
          role="img"
          aria-label={`Today's spend is ${rupees(spend.todayInr)} of the ${rupees(
            spend.ceilingInr,
            0,
          )} daily ceiling.`}
        >
          <div
            className={`h-full rounded-full ${nearCeiling ? "bg-celebrate" : "bg-primary"}`}
            style={{ width: `${ceilingPct}%` }}
          />
        </div>
        <p className="text-caption text-muted">
          At the ceiling the tutor returns its unavailable state and lessons,
          practice and quizzes keep working.
        </p>
      </div>

      <table className="w-full text-body-sm border-collapse">
        <thead>
          <tr className="text-left text-caption text-muted">
            <th scope="col" className="font-medium py-xs">Kind</th>
            <th scope="col" className="font-medium py-xs text-right">Calls</th>
            <th scope="col" className="font-medium py-xs text-right">Total</th>
            <th scope="col" className="font-medium py-xs text-right">Each</th>
          </tr>
        </thead>
        <tbody>
          {spend.byKind.map((k) => (
            <tr key={k.kind} className="border-t border-border">
              <td className="py-sm text-ink">{k.kind}</td>
              <td className="py-sm text-right text-body">{k.calls}</td>
              <td className="py-sm text-right text-body">{rupees(k.inr)}</td>
              <td className="py-sm text-right text-body">{rupees(k.perCall, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {spend.cacheWriteShare !== null && (
        <p className="text-caption text-muted">
          {Math.round(spend.cacheWriteShare * 100)}% of tutor input tokens went
          on <em>writing</em> the cache rather than reading it, which bills at
          1.25× instead of 0.1×. That is what a first-turn question costs. As
          learners hold longer conversations this falls, and so does the cost of
          an exchange.
        </p>
      )}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-md rounded-(--radius-card) border border-border bg-background px-lg py-lg">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}
