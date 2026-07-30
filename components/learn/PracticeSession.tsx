"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { t as tContent, tChoices } from "@/lib/i18n/content";
import { PRACTICE_SET_SIZE, type PracticeQuestion } from "@/lib/learning/practiceSet";
import type { Locale } from "@/i18n/config";
import { MarkdownBody } from "./MarkdownBody";
import { AnswerInput } from "./AnswerInput";
import { FeedbackPanel } from "./FeedbackPanel";
import { MentorCta } from "./MentorCta";
import { MilestoneToast } from "./MilestoneToast";

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
  hint: string | null;
  milestonesEarned: string[];
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

  // Hints taken on THIS question. Reset per question, sent with the attempt, and
  // what D6 rule 2 counts.
  const [hintsUsed, setHintsUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [emptyAnswer, setEmptyAnswer] = useState(false);
  const [failed, setFailed] = useState(false);

  const [correctCount, setCorrectCount] = useState(0);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [mentorTrigger, setMentorTrigger] = useState<string | null>(null);

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
          hints_used: hintsUsed,
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
      if (body.milestonesEarned?.length) setMilestones(body.milestonesEarned);
      if (body.showMentorCta && body.mentorTrigger) setMentorTrigger(body.mentorTrigger);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  /** Same question, second go — after the hint has been read. */
  function tryAgain() {
    setHintsUsed(1);
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
      setHintsUsed(0);
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

        {milestones.length > 0 && (
          <MilestoneToast codes={milestones} onDismiss={() => setMilestones([])} />
        )}
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
          hint={result.hint}
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
            {/* Wrong, hint shown, solution not yet given: one more go. This is the
                escalation — hint first, worked method only if it is still not
                landing (spec §8). */}
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
      {mentorTrigger && <MentorCta conceptId={conceptId} trigger={mentorTrigger} />}

      {milestones.length > 0 && (
        <MilestoneToast codes={milestones} onDismiss={() => setMilestones([])} />
      )}
    </div>
  );
}
