import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/**
 * Lesson body — Markdown with KaTeX.
 *
 * A **Server Component on purpose**. react-markdown and KaTeX both run during the
 * server render, so the learner downloads the resulting HTML and the KaTeX
 * stylesheet — not the parser and not the maths engine. On a shared Android phone
 * over 4G that is the difference between a lesson that opens and one that spins.
 *
 * Typography comes from the design tokens, and `:lang(hi)` in globals.css moves the
 * whole body to the Devanagari scale (18px/1.75) with no work here.
 */
/**
 * react-markdown hands every override its internal AST node. Spreading that onto
 * the element writes `node="[object Object]"` into the HTML the learner downloads,
 * so it is stripped once here rather than destructured away in nine places.
 */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

export function LessonBody({ markdown }: { markdown: string }) {
  return (
    <div className="lesson-body flex flex-col gap-lg text-body text-ink">
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              // A content typo must not take down the lesson screen (spec §7).
              // With throwOnError off, KaTeX renders the raw source instead of
              // crashing — and errorColor keeps that from appearing in RED, which
              // is reserved for system failures. A malformed formula is our bug,
              // not something to alarm a learner about mid-lesson.
              throwOnError: false,
              errorColor: "var(--color-ink)",
            },
          ],
        ]}
        components={{
          h2: (props) => <h2 className="text-h2 text-ink mt-lg" {...withoutNode(props)} />,
          h3: (props) => <h3 className="text-h3 text-ink mt-lg" {...withoutNode(props)} />,
          p: (props) => <p className="text-body" {...withoutNode(props)} />,
          strong: (props) => (
            <strong className="font-semibold text-ink" {...withoutNode(props)} />
          ),
          ul: (props) => (
            <ul className="flex flex-col gap-sm list-disc ps-xl" {...withoutNode(props)} />
          ),
          ol: (props) => (
            <ol className="flex flex-col gap-sm list-decimal ps-xl" {...withoutNode(props)} />
          ),
          // The worked-example / key-rule panel: tinted surface with a 3px teal
          // left border (saathi-design § Micro-lesson).
          blockquote: (props) => (
            <blockquote
              className="bg-surface border-s-[3px] border-primary rounded-e-(--radius-control) px-lg py-md text-body text-ink"
              {...withoutNode(props)}
            />
          ),
          // The ASCII number line in lesson 2. Scrolls inside itself rather than
          // widening the page (design rule 8).
          pre: (props) => (
            <pre
              className="bg-surface rounded-(--radius-control) p-md overflow-x-auto text-body-sm"
              {...withoutNode(props)}
            />
          ),
          code: (props) => (
            <code className="font-mono text-body-sm" {...withoutNode(props)} />
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
