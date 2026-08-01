import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm, type FeedbackAnswers } from "@/components/learn/FeedbackForm";

/**
 * `/feedback` — what a real user thinks of Saathi (0018).
 *
 * Inside `(learn)`, so it is behind the auth layout. That is deliberate: to say
 * anything useful about a learning app you have to have used it, and using it
 * needs an account. A no-login form would collect "looks nice" from people who
 * never opened a lesson.
 *
 * It also means every response is attributable to a distinct real account,
 * which is the claim the submission makes — without the export ever carrying an
 * email address.
 *
 * Existing answers are loaded so returning here is an edit, not a second
 * opinion. `product_feedback` is unique on `user_id` and the route upserts.
 */
export default async function FeedbackPage() {
  const t = await getTranslations("productFeedback");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes this to the caller's own row — the `.eq` is the belt to that
  // braces, not the boundary itself.
  const { data: existing } = await supabase
    .from("product_feedback")
    .select("respondent_role, understood, would_return, worked_well, confusing")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl">
      <header className="flex flex-col gap-lg">
        <Link
          href="/learn"
          aria-label={t("back")}
          className="inline-flex items-center justify-center size-11 -ms-sm rounded-(--radius-control) text-body hover:bg-surface"
        >
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        </Link>
        <h1 className="text-h1 text-ink">{t("title")}</h1>
        <p className="text-body text-body">{t("intro")}</p>
      </header>

      <FeedbackForm initial={(existing as FeedbackAnswers | null) ?? null} />
    </main>
  );
}
