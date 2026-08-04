/**
 * What every number on this page actually counts.
 *
 * ── WHY THIS IS ON THE PAGE AND NOT ONLY IN THE DOCS ────────────────────────
 * The point of `/admin/metrics` is that reading it needs no SQL and no asking
 * anybody. A figure whose definition lives in a markdown file somewhere fails
 * that test the first time you wonder whether a reload counted twice.
 *
 * Each entry says what counts, what does NOT count, and any distortion — in the
 * same voice as the rest of the product. Plain, second person, no event names.
 * "Finished a lesson", never `lesson_completed`.
 *
 * The awkward ones are here in full rather than softened. A caveat that only
 * appears when somebody goes looking is a caveat that arrives after the number
 * is already in a slide.
 */
const ENTRIES: { term: string; body: string }[] = [
  {
    term: "Opened the app",
    body:
      "Someone loaded the first screen. This counts VISITS, NOT PEOPLE — we record nothing that could tell one person from another before they have an account, so a reload counts twice and so does the browser loading a page in advance. Treat it as a ceiling, and never divide a later number by it.",
  },
  {
    term: "Got an account",
    body:
      "Signed in and reached the screen that asks which class they are in. Anyone who picked a class is counted here too, whether or not we saw them arrive — we only started recording this step on 4 August 2026, and picking a class means they must have got through it.",
  },
  {
    term: "Picked a class",
    body:
      "Finished signing up. This is the number to call 'learners' — everything before it is somebody who might still walk away, and everything after it is somebody we can actually measure.",
  },
  {
    term: "Finished a lesson",
    body:
      "Got to the end of a lesson and pressed the button that marks it done. Re-opening a lesson you already finished does not count again.",
  },
  {
    term: "Finished a chapter",
    body:
      "Completed every lesson in a chapter. Counted at the moment the last one is done, so it stays true even if the chapter gains a lesson later.",
  },
  {
    term: "Activated",
    body:
      "Finished at least one lesson, ever. The single most useful number on this page: someone who signed up and never finished a lesson has not used Dagar, whatever else they clicked.",
  },
  {
    term: "Still coming back",
    body:
      "Was active on at least two different days, Indian time. A learner who did everything in one long evening is deliberately not counted — the question is whether they returned, not how much they did.",
  },
  {
    term: "Asked for a human",
    body:
      "Tapped the offer of a real teacher. We do not send one yet; this measures how much it is wanted. The second number is how many times the offer was shown, because six requests out of eight offers and six out of two hundred are opposite findings.",
  },
  {
    term: "Asked for a hint",
    body:
      "Requested help on a practice question before answering it. Counted when the request is made, so a hint that failed to load still counts as asked.",
  },
  {
    term: "Recommendation accepted",
    body:
      "Arrived at the lesson or practice that the dashboard suggested. Counted on ARRIVAL, not on tap, so a tap that never finished loading does not count. The number it is divided by has been corrected for the app recording the same dashboard visit twice.",
  },
  {
    term: "Where they stop",
    body:
      "The lesson after which the most learners go no further, and how many. It names the lesson to go and read, not the one they failed at. It only appears when at least two learners stopped in the same place — one person stopping is not a pattern. A chapter that loses nobody shows nothing here.",
  },
  {
    term: "This week / Today",
    body:
      "Picks the learners who JOINED in that period and follows them, rather than filtering activity by date. Filtering by date would let a rate go above 100%, because someone who joined last week and finished a lesson today would be counted in one half of the fraction and not the other.",
  },
];

export function Glossary() {
  return (
    <section className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h2 className="text-h2 text-ink">What these numbers mean</h2>
        <p className="text-body-sm text-body">
          What counts, what does not, and where a number is less certain than it
          looks.
        </p>
      </div>

      <dl className="flex flex-col gap-md m-0">
        {ENTRIES.map((entry) => (
          <div
            key={entry.term}
            className="flex flex-col gap-xs rounded-(--radius-card) border border-border bg-background px-lg py-md"
          >
            <dt className="text-label font-medium text-ink">{entry.term}</dt>
            <dd className="text-body-sm text-body m-0">{entry.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
