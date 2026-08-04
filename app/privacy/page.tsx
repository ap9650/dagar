import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/BackLink";

export const metadata = {
  title: "What we keep · Dagar",
};

/**
 * What Dagar keeps, in words a 12-year-old and their parent can both read.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS WORDED LIKE THIS ─────────────────────────
 * Written 3 Aug 2026, after a real Brilliant signup was compared against ours.
 * Theirs itemises what is collected and mails it to a parent for approval; ours
 * said nothing at all — there was no privacy page, no terms page, and no notice
 * at signup. For a product whose entire user base is 11–14, "nothing" is not a
 * defensible position however careful the engineering behind it is.
 *
 * This is NOT verifiable parental consent (DPDP §9(1)) and does not pretend to
 * be. That is the Brilliant-style flow — parent's email, itemised permission
 * mail, activation on click — and it is scheduled for after the buildathon,
 * before Dagar goes anywhere beyond a teacher handing it to her own class.
 * Building it now would mean a child on a shared phone cannot open a lesson
 * until an adult clicks a link, which for this week's classroom means most of
 * them never start.
 *
 * So this page does the honest, useful thing in the meantime: it tells whoever
 * is holding the phone exactly what is kept and how to be rid of it. A page in
 * legal register would fail at that, and failing at that is the only way this
 * page can be wrong.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Every claim here is checked against the code, not aspirational:
 *   - "we never share with anyone else" — there is no third-party analytics,
 *     no tracking pixel, no ad network. Do not add one without changing this.
 *   - "we do not keep what you type to the tutor in our reports" — enforced in
 *     `lib/analytics/track.ts`, which drops 14 forbidden keys and any value
 *     over 64 characters.
 *   - "90 days" — the tutor-transcript retention in D11.
 */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  // Written out rather than looped: next-intl types its keys, and a template
  // literal defeats that — which is exactly the check that catches a section
  // renamed in `en.json` and forgotten in `hi.json`.
  const kept = [
    {
      key: "account",
      title: t("account.title"),
      items: [t("account.email"), t("account.grade"), t("account.language")],
    },
    {
      key: "learning",
      title: t("learning.title"),
      items: [t("learning.lessons"), t("learning.answers"), t("learning.streak")],
    },
    {
      key: "tutor",
      title: t("tutor.title"),
      items: [t("tutor.questions"), t("tutor.retention")],
    },
  ];

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex items-center gap-md">
        <BackLink href="/login" label={t("back")} />
        <h1 className="text-h2 text-ink">{t("title")}</h1>
      </header>

      <p className="text-body text-ink">{t("intro")}</p>

      <section className="flex flex-col gap-lg">
        {kept.map(({ key, title, items }) => (
          <div key={key} className="flex flex-col gap-sm">
            <h2 className="text-h3 text-ink">{title}</h2>
            <ul className="flex flex-col gap-xs list-none m-0 p-0">
              {items.map((item) => (
                <li key={item} className="text-body-sm text-body flex gap-sm">
                  <span aria-hidden className="text-primary">
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* The two promises that matter most, given the reader. Set apart on
          purpose — a parent skimming this on a phone should not have to find
          them inside a paragraph. */}
      <section className="flex flex-col gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg">
        <p className="text-label font-medium text-primary-strong">{t("promises.title")}</p>
        <p className="text-body-sm text-body">{t("promises.thirdParty")}</p>
        <p className="text-body-sm text-body">{t("promises.noAds")}</p>
        <p className="text-body-sm text-body">{t("promises.free")}</p>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="text-h3 text-ink">{t("delete.title")}</h2>
        <p className="text-body-sm text-body">{t("delete.body")}</p>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="text-h3 text-ink">{t("parents.title")}</h2>
        <p className="text-body-sm text-body">{t("parents.body")}</p>
        <Link
          href="/for-parents"
          className="min-h-11 inline-flex items-center text-body-sm text-primary-strong underline underline-offset-4"
        >
          {t("parents.link")}
        </Link>
      </section>
    </main>
  );
}
