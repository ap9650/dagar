"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Lightbulb } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { t as tContent, tChoices } from "@/lib/i18n/content";
import type { MasteryBand } from "@/lib/learning/mastery";
import type {
  QuizQuestion,
  QuizStartResponse,
  QuizSubmitResponse,
} from "@/lib/learning/quizSet";
import type { Locale } from "@/i18n/config";
import { MarkdownBody } from "./MarkdownBody";
import { AnswerInput } from "./AnswerInput";
import { MentorCta } from "./MentorCta";
import { MilestoneToast } from "./MilestoneToast";

/**
 * The chapter quiz (slice 2.4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE THINGS THIS COMPONENT DELIBERATELY DOES NOT HAVE, and each is a spec
 * requirement rather than an omission:
 *
 *   no hint button      — a quiz measures what the learner can do unaided
 *   no per-question feedback before submit — no "correct!" mid-quiz
 *   no difficulty adaptation — the set is fixed at start and never re-fetched
 *
 * It also has no answer key, exactly as the practice screen has none: `start`
 * returns questions from `questions_public`, and `solution_md` arrives only in
 * the submit response, after every answer is locked in.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Answers live in `answers` and are sent in ONE request at the end. That is what
 * makes the retry in `submit()` safe to offer: a dropped packet on 4G loses the
 * response, not the quiz, and the learner presses the button again rather than
 * answering eight questions a second time (spec §6).
 */

type Phase = "intro" | "answering" | "results";

export function QuizRunner({
  chapterId,
  questionCount,
  conceptNames,
  lastResult,
}: {
  chapterId: string;
  /** From the server render, so the intro can say how long this will take. */
  questionCount: number;
  conceptNames: Record<string, string>;
  lastResult: { score: number; total: number; band: MasteryBand } | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [milestones, setMilestones] = useState<string[]>([]);

  // Focus lands here when a new question renders, so a keyboard user is not
  // dropped back at the top of the document on every Next.
  const questionHeading = useRef<HTMLDivElement>(null);

  const question = questions[index];
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [questions, answers],
  );

  async function start() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/quiz/${chapterId}/start`, { method: "POST" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body = (await response.json()) as QuizStartResponse;
      if (!body.questions?.length) {
        setFailed(true);
        return;
      }
      setSessionId(body.session_id);
      setQuestions(body.questions);
      setIndex(0);
      setPhase("answering");
      // Answers are NOT cleared here. Resuming an abandoned quiz returns the same
      // question ids, so anything already typed in this browser session still
      // lines up with the question it belongs to.
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // Move focus to the new question after every move — including the move from
  // the intro into question 1.
  //
  // In an effect rather than in the click handler: pressing Back on question 2
  // un-renders the Back button itself, and a browser whose focused element is
  // removed drops focus to <body>. Focusing from inside the handler raced that
  // and lost, leaving a keyboard user at the top of the document. An effect runs
  // after the commit, so it is the last thing to touch focus.
  useEffect(() => {
    if (phase !== "answering") return;
    questionHeading.current?.focus();
  }, [index, phase]);

  function go(next: number) {
    setIndex(next);
  }

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/quiz/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q) => ({
            question_id: q.id,
            given_answer: answers[q.id] ?? "",
          })),
        }),
      });

      if (!response.ok) {
        // The answers stay in state and the button stays on screen. Losing a
        // finished quiz to one bad request is not an acceptable outcome, and a
        // bad request is likely on this audience's connection.
        setFailed(true);
        return;
      }

      const body = (await response.json()) as QuizSubmitResponse;
      setResult(body);
      setPhase("results");
      if (body.milestonesEarned?.length) setMilestones(body.milestonesEarned);
      // Mastery, the journey path and the daily goal all moved server-side.
      // Re-read them rather than guessing at them here.
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const offlineNote = failed && (
    // Amber, and only for the network — nothing the learner did went wrong.
    <p role="status" className="text-body-sm text-notquite">
      {t("errors.offline")}
    </p>
  );

  // ── intro ────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-sm rounded-(--radius-card) border border-border bg-surface px-lg py-lg">
          <p className="text-h3 text-ink">{t("quiz.questionCount", { count: questionCount })}</p>
          <p className="text-body-sm text-body">{t("quiz.intro")}</p>
        </div>

        {lastResult && (
          <div className="flex items-center justify-between gap-md">
            <span className="text-body-sm text-muted">
              {t("quiz.lastResult", { correct: lastResult.score, total: lastResult.total })}
            </span>
            <Badge tone={lastResult.band}>{t(`mastery.${lastResult.band}`)}</Badge>
          </div>
        )}

        {offlineNote}

        <Button onClick={start} loading={busy}>
          {lastResult ? t("quiz.retake") : t("quiz.start")}
        </Button>
      </div>
    );
  }

  // ── results ──────────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const byId = new Map(questions.map((q) => [q.id, q]));

    // The concept with the most wrong answers — where practice would help most.
    // Ties break toward the earlier question, which is the earlier concept in
    // the chapter, which is the one the later ones build on.
    const wrongByConcept = new Map<string, number>();
    for (const item of result.perQuestion) {
      if (item.is_correct) continue;
      const conceptId = byId.get(item.question_id)?.concept_id;
      if (!conceptId) continue;
      wrongByConcept.set(conceptId, (wrongByConcept.get(conceptId) ?? 0) + 1);
    }
    const weakest = [...wrongByConcept.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return (
      <div className="flex flex-col gap-xl">
        <section
          aria-labelledby="quiz-result-heading"
          className="flex flex-col gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-lg"
        >
          <h2 id="quiz-result-heading" className="text-h2 text-ink">
            {t(`quiz.band.${result.band}`)}
          </h2>
          {/* The number, always paired with the words above it — a band alone
              hides how close they were, and a bare number is not encouragement. */}
          <p className="text-body text-body">
            {t("quiz.result", { correct: result.score, total: result.total })}
          </p>
          <Badge tone={result.band} className="self-start">
            {t(`mastery.${result.band}`)}
          </Badge>
          <p className="text-body-sm text-body">{t("quiz.resultEncourage")}</p>
        </section>

        <section className="flex flex-col gap-lg">
          <h2 className="text-label text-muted">{t("quiz.answersTitle")}</h2>

          <ol className="flex flex-col gap-lg">
            {result.perQuestion.map((item, position) => {
              const q = byId.get(item.question_id);
              const stem = q ? tContent(q, "stem_md", locale) : "";

              return (
                <li
                  key={item.question_id}
                  className={
                    "flex flex-col gap-md rounded-(--radius-card) border px-lg py-md " +
                    (item.is_correct
                      ? "border-correct bg-correct-soft"
                      : "border-notquite bg-notquite-soft")
                  }
                >
                  {/* Icon AND words, never colour alone (design rule 10). */}
                  <p
                    className={
                      "flex items-center gap-sm text-label font-medium " +
                      (item.is_correct ? "text-correct" : "text-notquite")
                    }
                  >
                    {item.is_correct ? (
                      <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden />
                    ) : item.answered ? (
                      <Lightbulb size={20} strokeWidth={1.75} aria-hidden />
                    ) : (
                      <CircleDashed size={20} strokeWidth={1.75} aria-hidden />
                    )}
                    {t("quiz.questionNumber", { number: position + 1 })} ·{" "}
                    {item.is_correct
                      ? t("feedback.correct")
                      : item.answered
                        ? t("quiz.notQuite")
                        : t("quiz.skipped")}
                  </p>

                  {stem && (
                    <div className="text-body-sm text-ink">
                      <MarkdownBody markdown={stem} />
                    </div>
                  )}

                  {/* Every wrong answer shows its worked method (spec §5). This
                      is the whole reason feedback waits until submit: here it
                      teaches, mid-quiz it would just be the answer key. */}
                  {!item.is_correct && item.solution_md && (
                    <div className="flex flex-col gap-xs">
                      <p className="text-caption font-medium text-notquite">
                        {t("feedback.solutionTitle")}
                      </p>
                      <div className="text-body-sm text-ink">
                        <MarkdownBody markdown={item.solution_md} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* There is always somewhere to go next — never a verdict and a dead end
            (spec §6, the learner who scored 0 is the one this product is for). */}
        <div className="flex flex-col gap-md">
          {weakest && conceptNames[weakest] && (
            <Link href={`/practice/${weakest}`} className={buttonClasses("primary")}>
              {t("quiz.practiseConcept", { concept: conceptNames[weakest] })}
            </Link>
          )}
          <Link href="/learn" className={buttonClasses("secondary")}>
            {t("quiz.backToChapter")}
          </Link>
        </div>

        {/* D6, and it appears HERE rather than mid-quiz on purpose: three wrong
            in a row is ordinary inside a quiz, and offering a mentor on question
            four would be the app telling a learner they are failing while they
            are still sitting it (mentor-request.md §7). */}
        {result.showMentorCta && result.mentorTrigger && (
          <MentorCta
            conceptId={result.mentorConceptId ?? undefined}
            trigger={result.mentorTrigger}
          />
        )}

        {milestones.length > 0 && (
          <MilestoneToast codes={milestones} onDismiss={() => setMilestones([])} />
        )}
      </div>
    );
  }

  // ── answering ────────────────────────────────────────────────────────────
  if (!question) return null;

  const stem = tContent(question, "stem_md", locale);
  const choices = tChoices(question, locale);
  const isLast = index === questions.length - 1;

  return (
    <div className="flex flex-col gap-xl">
      <ProgressBar
        value={index + 1}
        max={questions.length}
        label={t("practice.questionOf", { number: index + 1, total: questions.length })}
      />

      {/* Focus lands here on every move, so a keyboard user is not dropped back
          at the top of the document each time they press Next. */}
      <div
        ref={questionHeading}
        tabIndex={-1}
        className="flex flex-col gap-lg outline-none focus-visible:ring-[3px] focus-visible:ring-primary-soft rounded-(--radius-control)"
      >
        {/* Progress is ANNOUNCED, not only shown (spec §5). Screen-reader only,
            because the progress bar above already carries the same words for
            everyone else — printing them twice on a 360px screen is clutter. */}
        <p role="status" className="sr-only">
          {t("practice.questionOf", { number: index + 1, total: questions.length })}
        </p>

        <div className="text-body text-ink">
          <MarkdownBody markdown={stem} />
        </div>
      </div>

      <AnswerInput
        answerType={question.answer_type}
        choices={choices}
        value={answers[question.id] ?? ""}
        onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
        // Enter moves on rather than submitting the quiz: on the last question a
        // stray Enter would end the quiz with no way back.
        onSubmit={() => {
          if (!isLast) go(index + 1);
        }}
        disabled={busy}
      />

      {offlineNote}

      <div className="flex flex-col gap-md">
        {isLast ? (
          <Button onClick={submit} loading={busy}>
            {t("quiz.submit")}
          </Button>
        ) : (
          <Button onClick={() => go(index + 1)}>{t("quiz.next")}</Button>
        )}

        {index > 0 && (
          // Going back is allowed and answers survive it. A learner who realises
          // on question 6 what question 2 was asking should be able to fix it —
          // this is a quiz, not an exam hall.
          <Button variant="ghost" onClick={() => go(index - 1)}>
            {t("quiz.previous")}
          </Button>
        )}

        <p className="text-caption text-muted">
          {t("quiz.answeredCount", { done: answeredCount, total: questions.length })}
        </p>
      </div>
    </div>
  );
}
