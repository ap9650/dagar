import { istDate } from "./dates";
import { worthCelebrating, type Level, LEVELS } from "./levels";

/**
 * "What moved this week" — a diary, not a photograph.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FIX FOR "IT IS VERY STATIC".
 *
 * Everything else on the progress screen reports where a learner IS. A streak
 * number, a list of concepts, a grid of badges — all true, all identical the
 * morning after a hard evening's work. The effort left no trace, so the screen
 * quietly said that nothing had happened.
 *
 * This reports what CHANGED. It is the only element that can prove yesterday
 * was real.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure: it takes events and returns entries carrying ids, never titles. The
 * page resolves names against the curriculum in the learner's language — a
 * lookup in here would drag content and locale into a module whose whole job is
 * deciding what counts as news.
 */

/** How many entries a week may show before it stops being readable. */
export const DIARY_LIMIT = 8;

/**
 * The only event names the diary reads — used to narrow the query as well as
 * the mapping below, so a busy week of `dashboard_viewed` rows never crowds out
 * the four lines that matter inside the row limit.
 */
export const DIARY_EVENTS = [
  "concept_level_changed",
  "lesson_completed",
  "chapter_completed",
  "milestone_earned",
] as const;

export type DiaryEvent = {
  name: string;
  /**
   * `unknown`, not a record: this is a `jsonb` column, so Postgres may hand
   * back a string, a number or null just as legally as an object. Narrowing at
   * the boundary — `prop()` below — means a malformed row is skipped rather
   * than crashing the progress screen.
   */
  props: unknown;
  created_at: string;
};

/** One key out of an event's props, or undefined if the shape is not an object. */
function prop(props: unknown, key: string): unknown {
  if (typeof props !== "object" || props === null || Array.isArray(props)) return undefined;
  return (props as Record<string, unknown>)[key];
}

export type DiaryEntry =
  | { kind: "level"; at: string; conceptId: string; to: Level }
  | { kind: "lesson"; at: string; lessonId: string }
  | { kind: "chapter"; at: string; chapterId: string }
  | { kind: "badge"; at: string; code: string };

/**
 * The week's news, newest first.
 *
 * ── WHAT IS DELIBERATELY NOT IN HERE ────────────────────────────────────────
 * Every attempt, every lesson *started*, every practice set. A diary of
 * everything is a diary of nothing — the four lines that matter would be buried
 * under forty that do not. Only finishing something, mastering something, or
 * earning something is news.
 *
 * `streak_extended` is also absent even though it fires most days: a line
 * saying "your streak went up" every single day is wallpaper, and the streak
 * card two inches above already says it. The streak reaches the diary only when
 * it crosses a rung, as a badge.
 */
export function buildDiary(events: readonly DiaryEvent[], now: Date = new Date()): DiaryEntry[] {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  const from = since.getTime();

  const entries: DiaryEntry[] = [];

  for (const event of events) {
    const at = new Date(event.created_at).getTime();
    if (Number.isNaN(at) || at < from) continue;

    switch (event.name) {
      case "concept_level_changed": {
        const conceptId = str(prop(event.props, "concept_id"));
        const to = level(prop(event.props, "to"));
        const fromLevel = level(prop(event.props, "from"));
        // Upward only. Mastery genuinely falls — the score is the last five
        // attempts — and the badge on the concept list shows that truth at
        // once. But "Fractions went backwards on Thursday" is not a sentence
        // this product says to a child who is already behind. The event records
        // both directions for analytics; the filtering is presentation.
        if (!conceptId || !to || !fromLevel) break;
        if (!worthCelebrating(fromLevel, to)) break;
        entries.push({ kind: "level", at: event.created_at, conceptId, to });
        break;
      }
      case "lesson_completed": {
        const lessonId = str(prop(event.props, "lesson_id"));
        if (lessonId) entries.push({ kind: "lesson", at: event.created_at, lessonId });
        break;
      }
      case "chapter_completed": {
        const chapterId = str(prop(event.props, "chapter_id"));
        if (chapterId) entries.push({ kind: "chapter", at: event.created_at, chapterId });
        break;
      }
      case "milestone_earned": {
        const code = str(prop(event.props, "code"));
        if (code) entries.push({ kind: "badge", at: event.created_at, code });
        break;
      }
    }
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return capPerDay(dedupe(entries)).slice(0, DIARY_LIMIT);
}

/**
 * At most three lines from any one day.
 *
 * ── WHY A GLOBAL CAP WAS THE WRONG SHAPE ────────────────────────────────────
 * Reported from a phone: the week strip said two days worked, and "What moved"
 * listed only one of them. Nothing was broken — a single evening had produced
 * eight entries (five lessons, a chapter, a badge) and filled the whole list,
 * pushing the other day out entirely.
 *
 * Both sections cover the same seven days, so a learner comparing them
 * reasonably concludes a day went missing. And the section is called *what
 * moved this week*: the shape of the week is the thing it is for, so one busy
 * evening must not be able to hide the rest of it.
 *
 * Three from a day is enough to say what that day was. The rest of the list is
 * then spent on days the learner would otherwise not see at all.
 */
export const DIARY_PER_DAY = 3;

/** Milestones and chapters outrank lessons — a day's headline, not its log. */
const NOTABILITY: Record<DiaryEntry["kind"], number> = {
  badge: 0,
  chapter: 1,
  level: 2,
  lesson: 3,
};

function capPerDay(entries: readonly DiaryEntry[]): DiaryEntry[] {
  const byDay = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const day = istDate(new Date(entry.at));
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  const kept: DiaryEntry[] = [];
  for (const dayEntries of byDay.values()) {
    // Most notable first, then most recent — so a day that earned a badge shows
    // the badge, not whichever lesson happened to finish last.
    const ranked = [...dayEntries].sort(
      (a, b) =>
        NOTABILITY[a.kind] - NOTABILITY[b.kind] ||
        new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
    kept.push(...ranked.slice(0, DIARY_PER_DAY));
  }

  return kept.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/**
 * One line per thing, keeping the newest.
 *
 * A concept can cross a threshold several times in a week — the score is a
 * five-attempt window, so a wobbling concept emits repeatedly — and four lines
 * about the same idea would crowd out the rest of the week. The learner cares
 * that it is now Mastered, not about the road there.
 */
function dedupe(entries: readonly DiaryEntry[]): DiaryEntry[] {
  const seen = new Set<string>();
  const out: DiaryEntry[] = [];
  for (const entry of entries) {
    const key =
      entry.kind === "level"
        ? `level:${entry.conceptId}`
        : entry.kind === "lesson"
          ? `lesson:${entry.lessonId}`
          : entry.kind === "chapter"
            ? `chapter:${entry.chapterId}`
            : `badge:${entry.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/** The IST weekday an entry belongs to — the little "Wed" beside each line. */
export function entryDate(entry: DiaryEntry): string {
  return istDate(new Date(entry.at));
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function level(value: unknown): Level | null {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
    ? (value as Level)
    : null;
}
