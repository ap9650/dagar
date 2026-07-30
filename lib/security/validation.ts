import { NextResponse } from "next/server";
import { z } from "zod";

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
  // 6 chars, case-insensitive on entry — a parent typing lowercase should work.
  link_code: z.string().trim().toUpperCase().length(6),
});

export const attemptSchema = z.object({
  question_id: zUuid,
  given_answer: z.string().max(200), // cap before it reaches the grader
  hints_used: z.number().int().min(0).max(5).default(0),
  ms_taken: z.number().int().min(0).max(3_600_000).optional(),
  session_kind: z.enum(["practice", "quiz"]),
  quiz_session_id: zUuid.optional(),
});

export const tutorMessageSchema = z.object({
  lesson_id: zUuid,
  // Cap input length BEFORE the model call, not after — the whole point is to
  // bound what we pay for and what a learner can push into the prompt.
  message: z.string().trim().min(1).max(1000),
});

export const tutorFeedbackSchema = z.object({
  tutor_message_id: zUuid,
  helpful: z.boolean(),
});

export const mentorRequestSchema = z.object({
  concept_id: zUuid.optional(),
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
