import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/security/authGuard";
import { parseBody, tutorMessageSchema } from "@/lib/security/validation";
import { checkAiBudget, logAiCall } from "@/lib/security/aiBudget";
import { track } from "@/lib/analytics/track";
import { loadTutorContext, streamTutorReply } from "@/lib/ai/tutor";
import { TUTOR_MODEL } from "@/lib/ai/client";
import { costInr } from "@/lib/ai/pricing";
import { detectTutorStruggle } from "@/lib/learning/struggle";
import type { Locale } from "@/i18n/config";

/**
 * POST /api/tutor — the streamed tutor reply.
 *
 * ── WHY THIS STREAMS ────────────────────────────────────────────────────────
 * Not a nice-to-have. On 4G a learner staring at an unchanged screen concludes
 * the app is broken and closes it — so the first token has to arrive fast (D11:
 * under 2s at p75) and keep arriving. Everything about this handler is arranged
 * around getting bytes moving early: the budget check and grounding load happen
 * before the response starts, and every write that can wait until after the
 * stream does.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The wire format is newline-delimited JSON, one frame per line:
 *   {"t":"d","v":"…"}                      a text delta
 *   {"t":"end","id":"…","cta":true|false}  the assistant turn's id, D6 verdict
 *   {"t":"err","code":"…"}                 mid-stream failure; keep the partial
 *
 * NDJSON rather than SSE because this is a one-way stream inside our own app —
 * SSE's event names and reconnection semantics would be ceremony for nothing.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, tutorMessageSchema);
  if (!parsed.ok) return parsed.response;

  const { lesson_id, message } = parsed.data;
  const locale = (await getLocale()) as Locale;

  // Started HERE, not just before the model call.
  //
  // D11's "first token under 2s" is a promise about what the learner waits
  // through, and they wait through all of it — the budget check, the grounding
  // load, the writes. Timing only the model call reported 809ms while the
  // browser measured 2776ms, which is a metric that would have let the target
  // look met while the screen sat empty for nearly three seconds.
  const startedAt = Date.now();

  // ── budget, BEFORE the model call (D11) ──────────────────────────────────
  // Both ceilings degrade the tutor and nothing else: lessons, practice and the
  // quiz keep working, because the learner losing the whole app over an API
  // budget would be the worse failure by a distance.
  const budget = await checkAiBudget(auth.userId);
  if (!budget.allowed) {
    return NextResponse.json(
      {
        error: "Tutor unavailable",
        code: budget.reason === "rate_limited" ? "RATE_LIMITED" : "TUTOR_UNAVAILABLE",
      },
      {
        status: budget.reason === "rate_limited" ? 429 : 503,
        headers:
          budget.reason === "rate_limited"
            ? { "Retry-After": String(budget.retryAfterSeconds) }
            : undefined,
      },
    );
  }

  const supabase = await createClient();

  // Run together — they do not depend on each other, and every serial round
  // trip here is time the learner spends looking at nothing. `track()` has to
  // happen on this side of the response because it reads the session cookie,
  // and inside the stream callback below that context is already gone.
  const [context] = await Promise.all([
    loadTutorContext({ supabase, studentId: auth.userId, lessonId: lesson_id, locale }),
    track("ai_question_asked", { lesson_id }),
  ]);

  if (!context) {
    return NextResponse.json({ error: "Lesson not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const admin = createAdminClient();
  let firstTokenAt: number | null = null;
  let reply = "";

  const encoder = new TextEncoder();
  const frame = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Fired first: this puts the model request on the wire immediately, so
        // the write below overlaps with the model's own latency instead of
        // being added to it.
        const modelStream = streamTutorReply({ context, message, locale });

        // The learner's turn is persisted BEFORE the reply. If the stream then
        // dies, their question survives and a retry has the history — losing
        // what they typed because our upstream had a bad minute is not a trade
        // worth making. It is not in `context.history`, which was read earlier.
        await admin.from("tutor_messages").insert({
          student_id: auth.userId,
          lesson_id,
          role: "user",
          content: message,
        });

        for await (const event of modelStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            firstTokenAt ??= Date.now();
            reply += event.delta.text;
            controller.enqueue(frame({ t: "d", v: event.delta.text }));
          }
        }

        const final = await modelStream.finalMessage();
        const usage = final.usage;

        // ── after the stream: persist, log, evaluate D6 ────────────────────
        // All of it on the admin client. Nothing here needs to cross a user
        // boundary, but nothing here has a cookie context either — the response
        // has already started.
        let assistantId: string | null = null;

        if (reply.trim().length > 0) {
          const { data: saved } = await admin
            .from("tutor_messages")
            .insert({
              student_id: auth.userId,
              lesson_id,
              role: "assistant",
              content: reply,
            })
            .select("id")
            .single();
          assistantId = saved?.id ?? null;
        }

        await logAiCall({
          student_id: auth.userId,
          kind: "tutor",
          model: TUTOR_MODEL,
          lesson_id,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_tokens: usage.cache_read_input_tokens ?? 0,
          cost_inr: costInr({
            model: TUTOR_MODEL,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cacheReadTokens: usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
          }),
          latency_ms: Date.now() - startedAt,
          ttft_ms: firstTokenAt ? firstTokenAt - startedAt : null,
          ok: true,
        });

        // D6 rule 3 — talking a lot and never practising.
        const { count: practiceAttempts } = await admin
          .from("attempts")
          .select("id", { count: "exact", head: true })
          .eq("student_id", auth.userId);

        const trigger = detectTutorStruggle({
          // +1: this exchange is not in `context.history`, which was read before it.
          tutorTurns: context.turnCount + 1,
          practiceAttempts: practiceAttempts ?? 0,
        });

        controller.enqueue(
          frame({ t: "end", id: assistantId, cta: trigger !== null, trigger }),
        );
      } catch (error) {
        console.error("[tutor] stream failed:", error);

        await logAiCall({
          student_id: auth.userId,
          kind: "tutor",
          model: TUTOR_MODEL,
          lesson_id,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cost_inr: 0,
          latency_ms: Date.now() - startedAt,
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
        });

        // A frame, not a thrown error: whatever the learner has already read
        // stays on their screen. Blanking a half-finished explanation because
        // the connection dropped at the end would be the worse outcome.
        controller.enqueue(frame({ t: "err", code: "TUTOR_FAILED" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Tells nginx-style proxies not to buffer, which would defeat streaming
      // by holding every token until the response completed.
      "X-Accel-Buffering": "no",
    },
  });
}
