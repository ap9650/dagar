/**
 * What to celebrate when a learner finishes something — **one moment, never a pile.**
 *
 * D7b gave us milestones and D17 lists "celebration moments" under what transfers
 * from Duolingo. Both were built. What was missing is the ordinary day: a milestone
 * is *rare* — seven codes, most earned once ever — so a learner on their fourth
 * lesson of the week finished to a line of small grey text. The single mechanic D17
 * calls "the strongest daily-return" was closing silently, off-screen, on the
 * dashboard they had already navigated away from.
 *
 * So there are exactly two moments here, and the discipline is in what is *not*:
 *
 * 1. **A milestone was earned.** Rare, specific, already named.
 * 2. **Today became a counted day.** Once per day, the moment the goal closes and
 *    the streak moves — which, by D7/D17, are the same event by design.
 *
 * Everything else is silence, deliberately. Finishing lesson 3 of 5 with the day
 * already counted is good work and gets a quiet "done" — celebrating it too would
 * be XP by another name, and D17 rejects XP for a reason that applies exactly here:
 * a second scoring system competes with concept mastery, which is the score that
 * means something.
 *
 * Pure. The server decides what happened; this decides what to say about it.
 */

export type Celebration =
  | { kind: "milestone"; codes: string[] }
  | { kind: "day"; streak: number };

/**
 * The parts of a completion response this reads.
 *
 * Everything is optional because all three completion routes swallow failures in
 * their derived-state block on purpose — the lesson stays complete even if the
 * streak RPC times out. A missing field means "we do not know", which must produce
 * silence rather than a wrong claim.
 */
export type CompletionResult = {
  milestonesEarned?: string[] | null;
  /** Did THIS call turn today into a counted day? Not "is today counted". */
  dayCounted?: boolean | null;
  streak?: number | null;
};

export function celebrationFor(result: CompletionResult): Celebration | null {
  const codes = result.milestonesEarned ?? [];

  // A milestone outranks the day, and they are never shown together.
  //
  // Two reasons. The obvious one: two celebrations at once is two things to
  // dismiss and neither gets read. The better one: on the day a milestone is
  // earned the day was almost always counted by the very same action —
  // `first_lesson` is only reachable on a day that just started counting — so
  // showing both would be reporting one event twice, in a smaller font.
  if (codes.length > 0) return { kind: "milestone", codes };

  if (result.dayCounted) {
    const streak = result.streak ?? 0;
    // Contradictory data: the day was counted but no streak came back, which means
    // the streak read failed. Say nothing rather than "0 days in a row" — a wrong
    // number in a celebration is worse than no celebration.
    if (streak < 1) return null;
    return { kind: "day", streak };
  }

  return null;
}
