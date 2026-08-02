"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { t as tContent, tChoices } from "@/lib/i18n/content";
import { PRACTICE_SET_SIZE, type PracticeQuestion } from "@/lib/learning/practiceSet";
import { HINT_TIERS } from "@/lib/learning/hints";
import type { Locale } from "@/i18n/config";
import { MarkdownBody } from "./MarkdownBody";
import { AnswerInput } from "./AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";
import { MentorCta } from "./MentorCta";
import { celebrationFor, type Celebration as Moment } from "@/lib/learning/celebration";
import { Celebration } from "./Celebration";

/**
 * The practice screen (slice 2.2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THERE IS NO CORRECTNESS CHECK ANYWHERE IN THIS FILE.
 *
 * It never receives an answer key, so it could not perform one. `answer_value`
 * lives in a column that `questions_public` does not select, and it is read in
 * exactly one place in the product — `POST /api/attempts`, with the service role,
 * after the learner has committed. A `if (answer === correct)` here would be a
 * bug, not a shortcut (D3).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The flow, and each step is a spec requirement:
 *
 *   answer → CORRECT  → green, with one line of why, then the next question
 *          → WRONG    → amber, with a HINT and "try again" — never a bare mark
 *          → WRONG #2 → amber, with the full worked method, then move on
 *
 * A wrong answer always leaves something to do. That is the whole design.
 */

type GradeResponse = {
  is_correct: boolean;
  solution_md: string | null;
  milestonesEarned: string[];
  /** True on the answer that turned today into a counted day — never after. */
  dayCounted: boolean;
  streak: number;
  showMentorCta: boolean;
  mentorTrigger: string | null;
};

type Phase = "answering" | "graded" | "finished";

export function PracticeSession({
  conceptId,
  firstQuestion,
}: {
  conceptId: string;
  /**
   * Rendered during the server render of the page, so entering practice never
   * shows a spinner. Every question after this one is fetched.
   */
  firstQuestion: PracticeQuestion;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [question, setQuestion] = useState<PracticeQuestion>(firstQuestion);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("answering");
  const [result, setResult] = useState<GradeResponse | null>(null);

  // Hints the learner ASKED FOR on this question, in tier order. The count is
  // sent with the attempt and is what D6 rule 2 counts; the text stays on
  // screen so a learner can read the whole ladder together.
  const [hints, setHints] = useState<string[]>([]);
  const [hintBusy, setHintBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emptyAnswer, setEmptyAnswer] = useState(false);
  const [failed, setFailed] = useState(false);

  const [correctCount, setCorrectCount] = useState(0);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [mentorTrigger, setMentorTrigger] = useState<string | null>(null);
  /**
   * A request has been filed for THIS concept, in THIS session.
   *
   * Scoped that narrowly on purpose. Asking for help must not remove the offer
   * from the rest of the chapter — a learner stuck on a different concept, or
   * back tomorrow, should be offered a mentor again, and `detectStruggle` will
   * raise it for them.
   *
   * What this prevents is only the immediate repeat: the struggle rule is "the
   * last three attempts were wrong", so a single further wrong answer re-fires
   * it seconds after they asked. Offering a mentor to someone who just
   * requested one reads as nagging, and files a second request about the same
   * concept for a person to work out.
   */
  const [mentorRequested, setMentorRequested] = useState(false);

  const seenIds = useRef<string[]>([firstQuestion.id]);
  const started = useRef(false);
  // One id per SUBMISSION. Regenerated on every Check, so a retry of a failed
  // request reuses it and the server collapses the duplicate (migration 0011),
  // while a genuine second attempt after a hint gets a fresh one.
  const submissionId = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "practice_started", props: { concept_id: conceptId } }),
    }).catch(() => {});
  }, [conceptId]);

  const stem = tContent(question, "stem_md", locale);
  const choices = tChoices(question, locale);
  const isLastQuestion = questionNumber >= PRACTICE_SET_SIZE;

  async function check() {
    if (answer.trim().length === 0) {
      // Caught before the request. A blank must never reach the server as an
      // attempt row — it would count against mastery for nothing.
      setEmptyAnswer(true);
      return;
    }

    setEmptyAnswer(false);
    setFailed(false);
    setBusy(true);

    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: question.id,
          given_answer: answer,
          hints_used: hints.length,
          session_kind: "practice",
          submission_id: submissionId.current,
        }),
      });

      if (response.status === 422) {
        setEmptyAnswer(true);
        return;
      }
      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body = (await response.json()) as GradeResponse;
      setResult(body);
      setPhase("graded");

      if (body.is_correct) setCorrectCount((count) => count + 1);
      // The fifth distinct question of the day closes the goal, so this is the
      // one place a celebration can arrive MID-SET rather than at the end.
      setMoment(celebrationFor(body));
      // `!mentorRequested` — not "never offer again", just not twice in a row
      // about the same concept. See the state declaration.
      if (body.showMentorCta && body.mentorTrigger && !mentorRequested) {
        setMentorTrigger(body.mentorTrigger);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  /** Ask for the next rung of the ladder (2.3). */
  async function askForHint() {
    if (hintBusy || hints.length >= HINT_TIERS) return;
    setHintBusy(true);
    try {
      const response = await fetch("/api/hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: question.id, tier: hints.length + 1 }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { hint: string };
      // The route falls back to a deterministic hint when the model call fails,
      // so an empty string here means there was genuinely nothing to say.
      if (body.hint?.trim()) setHints((prev) => [...prev, body.hint]);
    } catch {
      /* Silent: the learner still has "try again" and "next question". */
    } finally {
      setHintBusy(false);
    }
  }

  /** Same question, another go — keeping the hints they have read. */
  function tryAgain() {
    setResult(null);
    setPhase("answering");
    setFailed(false);
    submissionId.current = crypto.randomUUID();
  }

  const finish = useCallback(() => {
    setPhase("finished");
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "practice_completed",
        props: { concept_id: conceptId, correct: correctCount, total: PRACTICE_SET_SIZE },
      }),
    }).catch(() => {});
    // The server recomputed mastery, the streak and the goal ring. Re-read them
    // rather than guessing at them on the client.
    router.refresh();
  }, [conceptId, correctCount, router]);

  async function nextQuestion() {
    // The offer — and any confirmation it turned into — belongs to the question
    // that triggered it.
    //
    // `mentorTrigger` used to be set once and never cleared, so the card stayed
    // mounted for the rest of the session. A learner who asked for help then had
    // "Passed on… a person reads this, it can take a day or two" pinned under
    // every remaining question. Reported from real use, and it reads as though
    // the app is still waiting on you when the whole point of that copy is
    // "keep going, you do not have to wait".
    //
    // Cleared on the way to the next question, so the confirmation is seen once,
    // where it happened. If they get stuck again the API raises the trigger
    // again — the offer is never lost, it just stops following them.
    setMentorTrigger(null);

    if (isLastQuestion) {
      finish();
      return;
    }

    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch(
        `/api/practice/${conceptId}/next?seen=${seenIds.current.join(",")}`,
      );
      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body = (await response.json()) as { question: PracticeQuestion | null };
      if (!body.question) {
        // The concept's bank ran dry mid-set. Finishing early is honest and shows
        // the summary; an empty question card is not.
        finish();
        return;
      }

      seenIds.current = [...seenIds.current, body.question.id];
      setQuestion(body.question);
      setQuestionNumber((number) => number + 1);
      setAnswer("");
      setHints([]);
      setResult(null);
      setPhase("answering");
      submissionId.current = crypto.randomUUID();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // ── the summary ──────────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-sm rounded-(--radius-card) border border-border bg-surface px-lg py-lg">
          <p className="text-h3 text-ink">
            {t("practice.summary", { correct: correctCount, total: PRACTICE_SET_SIZE })}
          </p>
          {/* Encouragement that is true whatever the score. Never a grade, never a
              comparison — the number above is the only number on this screen. */}
          <p className="text-body-sm text-body">{t("practice.summaryEncourage")}</p>
        </div>

        <Button onClick={() => router.push("/learn")}>{t("errors.backHome")}</Button>

        <Celebration moment={moment} onDismiss={() => setMoment(null)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xl">
      <ProgressBar
        value={questionNumber}
        max={PRACTICE_SET_SIZE}
        label={t("practice.questionOf", {
          number: questionNumber,
          total: PRACTICE_SET_SIZE,
        })}
      />

      <div className="text-body text-ink">
        <MarkdownBody markdown={stem} />
      </div>

      <AnswerInput
        answerType={question.answer_type}
        choices={choices}
        input={question.input}
        value={answer}
        onChange={(next) => {
          setAnswer(next);
          setEmptyAnswer(false);
        }}
        onSubmit={() => {
          if (phase === "answering" && !busy) void check();
        }}
        disabled={phase === "graded" || busy}
      />

      {emptyAnswer && (
        <p role="alert" className="text-body-sm text-notquite">
          {t("feedback.emptyAnswer")}
        </p>
      )}

      {phase === "graded" && result && (
        <FeedbackPanel
          isCorrect={result.is_correct}
          hints={hints}
          solutionMd={result.solution_md}
        />
      )}

      {/* Amber, and only for the network. Nothing the learner did went wrong. */}
      {failed && (
        <p role="status" className="text-body-sm text-notquite">
          {t("errors.offline")}
        </p>
      )}

      <div className="flex flex-col gap-md">
        {phase === "answering" && (
          <Button onClick={check} loading={busy}>
            {t("practice.check")}
          </Button>
        )}

        {phase === "graded" && result && (
          <>
            {/* The ladder (2.3): the learner chooses how much help to take, one
                rung at a time, and the worked solution only arrives once all
                three are spent. Help they asked for teaches; help pushed at
                them does not. */}
            {!result.is_correct && !result.solution_md && hints.length < HINT_TIERS && (
              <Button variant="secondary" onClick={askForHint} loading={hintBusy}>
                {t("practice.showHint")}
              </Button>
            )}

            {!result.is_correct && !result.solution_md && (
              <Button onClick={tryAgain}>{t("feedback.tryAgain")}</Button>
            )}

            <Button
              variant={
                result.is_correct || result.solution_md ? "primary" : "secondary"
              }
              onClick={nextQuestion}
              loading={busy}
            >
              {isLastQuestion ? t("practice.finish") : t("practice.nextQuestion")}
            </Button>
          </>
        )}
      </div>

      {/* D6. Below the actions, never over them. */}
      {mentorTrigger && (
        <MentorCta
          conceptId={conceptId}
          trigger={mentorTrigger}
          onDismissed={() => setMentorTrigger(null)}
          onSent={() => setMentorRequested(true)}
        />
      )}

      <Celebration moment={moment} onDismiss={() => setMoment(null)} />
    </div>
  );
}
