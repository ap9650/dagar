import { NextResponse } from "next/server";
import { z } from "zod";
import { LINK_CODE_LENGTH, normaliseLinkCode } from "@/lib/parent/linkCode";

/**
 * Input validation for route handlers. Every handler validates before touching
 * the database — no exceptions.
 *
 * Note what is NOT here: `student_id`. Identity comes from the session via
 * requireAuth(), never from the request body. A schema that accepts a
 * student_id is an impersonation vector, so none of these have one.
 */

// ─── shared field types ──────────────────────────────────────────────────────

export const zLocale = z.enum(["en", "hi"]);
export const zGrade = z.union([z.literal(6), z.literal(7), z.literal(8)]);
export const zUuid = z.string().uuid();

/** Display name only — never DOB, address, photo or location (minors' data). */
export const zDisplayName = z.string().trim().min(1).max(40).optional();

// ─── request schemas ─────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = signupSchema;

export const createProfileSchema = z.object({
  grade: zGrade,
  locale: zLocale,
  display_name: zDisplayName,
});

export const updateProfileSchema = z.object({
  grade: zGrade.optional(),
  locale: zLocale.optional(),
  display_name: zDisplayName,
});

export const claimLinkCodeSchema = z.object({
  /**
   * Normalised with the SAME function the entry field uses, before the length
   * check rather than after.
   *
   * The first version was `.trim().toUpperCase().length(6)`, which rejected
   * `U32-2CT` and `u32 2ct` outright — and a code pasted out of WhatsApp is
   * exactly where a stray hyphen or space comes from. The client form happens to
   * normalise first, so this only bit a direct call; but a server schema that is
   * stricter than the client is a trap for the next caller, and "that code did
   * not work" for a correct code is the worst message in this flow.
   */
  link_code: z
    .string()
    .max(64) // bound the input before any work is done on it
    .transform(normaliseLinkCode)
    .refine((code) => code.length === LINK_CODE_LENGTH, {
      message: `Link code must be ${LINK_CODE_LENGTH} characters`,
    }),
});

export const attemptSchema = z.object({
  question_id: zUuid,
  given_answer: z.string().max(200), // cap before it reaches the grader
  hints_used: z.number().int().min(0).max(5).default(0),
  ms_taken: z.number().int().min(0).max(3_600_000).optional(),
  session_kind: z.enum(["practice", "quiz"]),
  quiz_session_id: zUuid.optional(),
  // Idempotency key, minted per submission by the client (migration 0011). A
  // retry after a dropped response collapses into the same attempt row instead
  // of spending two of the learner's five mastery slots on one question.
  submission_id: zUuid.optional(),
});

/**
 * Note what this schema does NOT contain: `is_correct`, `score`, `mastery`,
 * `streak`. Zod strips unknown keys, so a client that POSTs `is_correct: true`
 * has it dropped here before the handler ever sees it — the server regrades from
 * `answer_value` regardless. That is the guided-practice.md §7 security criterion,
 * enforced by the shape of this object rather than by a check someone has to
 * remember to write.
 */

/**
 * A whole quiz, submitted at once (slice 2.4).
 *
 * Note what is missing, exactly as in `attemptSchema`: `score`, `total`, `band`,
 * `is_correct`. Zod strips unknown keys, so a client POSTing its own score has it
 * dropped here — every answer is regraded from `answer_value` server-side. That
 * is chapter-quiz.md §5's "a client-submitted score is ignored", enforced by the
 * shape of this object rather than by a check someone has to remember to write.
 *
 * `.max(50)` bounds the work one request can ask for. Chapter quizzes are 8
 * questions; 50 is generous headroom and still not a lever.
 */
export const quizSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: zUuid,
        given_answer: z.string().max(200),
      }),
    )
    .max(50),
});

/**
 * Product feedback (0018).
 *
 * The two text fields are OPTIONAL and capped. Optional because a learner who
 * taps three buttons and writes nothing is still a real response; capped because
 * this is free text from the public and unbounded strings are a storage bill and
 * a rendering hazard.
 */

/**
 * The ceiling on a free-text answer, shared by the textarea, this schema and
 * the column's check constraint (0029). Exported so the form can show a counter
 * against the same number the server enforces — a client that thinks the limit
 * is one thing and a server that thinks it is another produces a submit button
 * that fails with no explanation.
 */
export const FEEDBACK_TEXT_MAX = 4000;

export const productFeedbackSchema = z.object({
  respondent_role: z.enum(["student", "parent", "teacher", "other"]),
  understood: z.enum(["yes", "a_bit", "no"]),
  would_return: z.enum(["yes", "maybe", "no"]),
  /** Optional so 0018 responses stay valid and a skipper still counts. */
  improve_most: z.enum(["chapters", "practice", "tutor", "phone", "other"]).optional(),
  // 4000, raised from 1000 after a learner hit the ceiling and was cut off
  // mid-sentence (migration 0029). Must stay in step with the column's check
  // constraint and the textarea's `maxLength`, or one layer truncates silently
  // and the other rejects loudly.
  worked_well: z.string().trim().max(FEEDBACK_TEXT_MAX).optional(),
  confusing: z.string().trim().max(FEEDBACK_TEXT_MAX).optional(),
});

export const tutorMessageSchema = z.object({
  lesson_id: zUuid,
  // Cap input length BEFORE the model call, not after — the whole point is to
  // bound what we pay for and what a learner can push into the prompt.
  message: z.string().trim().min(1).max(1000),
});

export const hintSchema = z.object({
  question_id: zUuid,
  // Tiers are 1-3 (lib/learning/hints.ts). A client asking for tier 9 gets a
  // 400 rather than a deeper hint than the ladder has.
  tier: z.number().int().min(1).max(3),
});

export const tutorFeedbackSchema = z.object({
  tutor_message_id: zUuid,
  helpful: z.boolean(),
});

export const mentorRequestSchema = z.object({
  concept_id: zUuid.optional(),
  // Set when the offer came from the tutor sheet (D6 rule 3), so the excerpt is
  // scoped to the lesson they were actually asking about.
  lesson_id: zUuid.optional(),
  trigger: z.enum([
    "three_consecutive_incorrect",
    "hints_exhausted_twice",
    "tutor_turns_no_practice",
  ]),
  learner_note: z.string().trim().max(500).optional(),
  // `context` is assembled SERVER-SIDE from real attempts and transcript.
  // Never accept it from the client — a forged payload would poison the record.
});

// ─── helper ──────────────────────────────────────────────────────────────────

export type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<Parsed<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body", code: "BAD_REQUEST" },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid request",
          code: "VALIDATION_FAILED",
          // Field paths only. Never echo the submitted values back — a learner's
          // input can contain anything and this response may be logged.
          fields: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}
