"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

/**
 * The product feedback form (0018).
 *
 * ── five questions, about sixty seconds ─────────────────────────────────────
 * Every extra field costs responses, and the people answering this include
 * 11–14 year olds on a phone. Two of the five are optional text, so someone who
 * taps three buttons and writes nothing is still a complete response — and a
 * teacher who wants to write three paragraphs can.
 *
 * Deliberately NOT a 1–5 star rating. "Did Saathi help you understand
 * something?" tests the claim the product actually makes; a 4.2 average is a
 * number nobody can act on.
 *
 * ── the controls are radios ─────────────────────────────────────────────────
 * Same pattern as the language and grade pickers: a visually hidden radio
 * behind a styled label. One tab stop per group, arrow keys between options, and
 * a real checked state — none of which a div with an onClick gives you.
 */

type Choice = { value: string; label: string };

export function FeedbackForm({ initial }: { initial?: FeedbackAnswers | null }) {
  const t = useTranslations("productFeedback");
  const groupId = useId();

  const [role, setRole] = useState(initial?.respondent_role ?? "");
  const [understood, setUnderstood] = useState(initial?.understood ?? "");
  const [wouldReturn, setWouldReturn] = useState(initial?.would_return ?? "");
  const [improveMost, setImproveMost] = useState(initial?.improve_most ?? "");
  const [workedWell, setWorkedWell] = useState(initial?.worked_well ?? "");
  const [confusing, setConfusing] = useState(initial?.confusing ?? "");

  const [state, setState] = useState<"editing" | "sending" | "sent" | "failed">(
    initial ? "sent" : "editing",
  );

  // The three button questions are required; the writing is not.
  const complete = Boolean(role && understood && wouldReturn);

  async function send() {
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondent_role: role,
          understood,
          would_return: wouldReturn,
          improve_most: improveMost || undefined,
          worked_well: workedWell.trim() || undefined,
          confusing: confusing.trim() || undefined,
        }),
      });
      setState(response.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <div
        role="status"
        className="flex flex-col gap-md rounded-(--radius-card) border border-primary bg-primary-wash px-lg py-lg"
      >
        <p className="text-h3 text-primary-strong">{t("sentTitle")}</p>
        <p className="text-body text-body">{t("sentBody")}</p>
        <button
          type="button"
          onClick={() => setState("editing")}
          className="self-start min-h-11 text-body-sm text-primary-strong underline underline-offset-4"
        >
          {t("edit")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xl">
      <RadioGroup
        name={`${groupId}-role`}
        legend={t("roleLabel")}
        value={role}
        onChange={setRole}
        options={[
          { value: "student", label: t("roleStudent") },
          { value: "parent", label: t("roleParent") },
          { value: "teacher", label: t("roleTeacher") },
          { value: "other", label: t("roleOther") },
        ]}
      />

      <RadioGroup
        name={`${groupId}-understood`}
        legend={t("understoodLabel")}
        value={understood}
        onChange={setUnderstood}
        options={[
          { value: "yes", label: t("understoodYes") },
          { value: "a_bit", label: t("understoodABit") },
          { value: "no", label: t("understoodNo") },
        ]}
      />

      {/*
        THE ONE QUESTION POLITENESS CANNOT ANSWER.

        Everything else here has a costless friendly reply, and these
        respondents are family, friends and a sister who teaches — they will be
        kind. "Did it help?" → yes tells us little, because the honest answer and
        the polite answer look the same.

        A forced trade-off does not have that escape: choosing more chapters
        means NOT choosing a better tutor. The answer carries a priority instead
        of a courtesy.

        Deliberately not "do you want more lessons?" — nobody has ever replied
        "no thanks, three chapters is plenty". That would have returned unanimous
        agreement and no information, while feeling like validation.
      */}
      <RadioGroup
        name={`${groupId}-improve`}
        legend={t("improveLabel")}
        value={improveMost}
        onChange={setImproveMost}
        options={[
          { value: "chapters", label: t("improveChapters") },
          { value: "practice", label: t("improvePractice") },
          { value: "tutor", label: t("improveTutor") },
          { value: "phone", label: t("improvePhone") },
          { value: "other", label: t("improveOther") },
        ]}
      />

      <FreeText
        label={t("workedLabel")}
        placeholder={t("workedPlaceholder")}
        value={workedWell}
        onChange={setWorkedWell}
      />

      <FreeText
        label={t("confusingLabel")}
        placeholder={t("confusingPlaceholder")}
        value={confusing}
        onChange={setConfusing}
      />

      <RadioGroup
        name={`${groupId}-return`}
        legend={t("returnLabel")}
        value={wouldReturn}
        onChange={setWouldReturn}
        options={[
          { value: "yes", label: t("returnYes") },
          { value: "maybe", label: t("returnMaybe") },
          { value: "no", label: t("returnNo") },
        ]}
      />

      {/* Said once, quietly, next to the boxes where it could happen. Some of
          the people answering are children, and the export is going to a third
          party — the cheapest protection is not collecting it in the first
          place. */}
      <p className="text-caption text-muted">{t("noPersonalDetails")}</p>

      {state === "failed" && (
        // Amber: nothing the person did went wrong.
        <p role="alert" className="text-body-sm text-notquite">
          {t("sendFailed")}
        </p>
      )}

      <Button onClick={send} disabled={!complete} loading={state === "sending"}>
        {t("submit")}
      </Button>
    </div>
  );
}

export type FeedbackAnswers = {
  respondent_role: string;
  understood: string;
  would_return: string;
  improve_most: string | null;
  worked_well: string | null;
  confusing: string | null;
};

function RadioGroup({
  name,
  legend,
  value,
  onChange,
  options,
}: {
  name: string;
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: Choice[];
}) {
  return (
    <fieldset className="flex flex-col gap-md border-0 p-0 m-0">
      <legend className="text-label font-medium text-ink mb-sm">{legend}</legend>
      <div className="flex flex-col gap-sm">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-14 items-center gap-md px-lg rounded-(--radius-card) border cursor-pointer",
                "transition-colors duration-150 ease-out",
                "focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-2",
                selected
                  ? "bg-primary-soft border-primary text-primary-strong"
                  : "bg-background border-border text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {/* Selection carries a tick as well as a fill — colour is never
                  the only signal (design rule 10). */}
              <span
                aria-hidden
                className={cn(
                  "inline-flex items-center justify-center size-6 shrink-0 rounded-full border-2",
                  selected ? "bg-primary border-primary text-white" : "border-border-strong",
                )}
              >
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="text-body">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FreeText({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-sm">
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-(--radius-control) border border-border-strong bg-background
                   px-md py-sm text-body text-ink
                   focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-soft"
      />
    </div>
  );
}
