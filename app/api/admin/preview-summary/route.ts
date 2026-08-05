import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/security/adminGuard";
import { generateParentSummary } from "@/lib/ai/summaries";
import type { WeeklySummary } from "@/lib/parent/summary";
import type { Locale } from "@/i18n/config";

/**
 * POST /api/admin/preview-summary — what the weekly parent message reads like.
 *
 * The body a parent receives is written by Haiku from the week's facts, so it
 * cannot be read off any screen before a Sunday cron has run. This runs the
 * REAL generator and the REAL prompt against INVENTED facts.
 *
 * Invented on purpose. Generating one for an actual learner would put a named
 * child's standing on an operator's screen, and `/admin/metrics` is built the
 * other way round — it never names a learner, deliberately. A preview whose
 * only job is to show tone and shape does not need a real child to do it.
 *
 * So what this proves is the writing, not the data: that the prompt produces
 * something an adult can read in ten seconds, in their language, with one thing
 * to do in it. Whether the facts are right is what `fetchWeeklySummary` and its
 * tests are for.
 */
export const dynamic = "force-dynamic";

/** A believable ordinary week: some progress, one weak spot, streak alive. */
function sampleWeek(locale: Locale): WeeklySummary {
  const concepts: WeeklySummary["concepts"] =
    locale === "hi"
      ? [
          { conceptId: "a", name: "भिन्न की बुनियाद", band: "mastered" },
          { conceptId: "b", name: "बराबर भिन्न", band: "developing" },
          { conceptId: "c", name: "भिन्न जोड़ना और घटाना", band: "needs_revision" },
        ]
      : [
          { conceptId: "a", name: "Fraction Basics", band: "mastered" },
          { conceptId: "b", name: "Equivalent Fractions", band: "developing" },
          { conceptId: "c", name: "Adding and Subtracting Fractions", band: "needs_revision" },
        ];

  return {
    learnerName: locale === "hi" ? "आरव" : "Aarav",
    grade: 6,
    lessonsThisWeek: 4,
    practiceThisWeek: 23,
    streak: { days: 5, alive: true, graceActive: true, longest: 5 },
    concepts,
    milestoneCodes: ["streak_3", "first_practice"],
    quiet: false,
    focus: concepts[2],
  };
}

export async function POST(request: Request) {
  const email = await getAdminEmail();
  if (!email) return new NextResponse(null, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale = (body.locale === "hi" ? "hi" : "en") as Locale;

  const summary = sampleWeek(locale);
  const generated = await generateParentSummary({
    summary,
    locale,
    // Not a real learner — the id only tags the AI cost log, and tagging this
    // to someone's account would put a preview's cost on their record.
    studentId: "00000000-0000-0000-0000-000000000000",
  });

  return NextResponse.json({
    ok: true,
    locale,
    body: generated.body,
    // "fallback" means the model call failed and the deterministic sentence was
    // used instead. Surfaced rather than hidden: a preview that quietly showed
    // the fallback would prove the opposite of what it claims to prove.
    source: generated.source,
    facts: summary,
  });
}
