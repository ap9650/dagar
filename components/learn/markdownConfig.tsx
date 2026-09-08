import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

/**
 * One markdown + KaTeX configuration, shared by the server renderer
 * (`LessonBody`) and the client one (`MarkdownBody`).
 *
 * It lives in its own file because the two renderers must agree. A worked example
 * that renders as a tinted panel in a lesson and as a bare indent in a practice
 * solution is the same content wearing two different faces, and the learner reads
 * both within a minute of each other.
 *
 * No `"use client"` here on purpose: this module is neutral, and each renderer
 * decides which side of the boundary it sits on.
 */

/**
 * react-markdown hands every override its internal AST node. Spreading that onto
 * the element writes `node="[object Object]"` into the delivered HTML, so it is
 * stripped once here rather than destructured away in a dozen places.
 */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

export const remarkPlugins = [remarkMath, remarkGfm];

export const rehypePlugins = [
  [
    rehypeKatex,
    {
      // A content typo must not take down a screen. With throwOnError off, KaTeX
      // renders the raw source instead of crashing — and errorColor keeps that out
      // of RED, which is reserved for system failures. A malformed formula is our
      // bug, not something to alarm a learner about mid-question.
      throwOnError: false,
      errorColor: "var(--color-ink)",
    },
  ],
] as const;

export const markdownComponents: Components = {
  h2: (props) => <h2 className="text-h2 text-ink mt-lg" {...withoutNode(props)} />,
  h3: (props) => <h3 className="text-h3 text-ink mt-lg" {...withoutNode(props)} />,
  p: (props) => <p className="text-body" {...withoutNode(props)} />,
  strong: (props) => <strong className="font-semibold text-ink" {...withoutNode(props)} />,
  ul: (props) => (
    <ul className="flex flex-col gap-sm list-disc ps-xl" {...withoutNode(props)} />
  ),
  ol: (props) => (
    <ol className="flex flex-col gap-sm list-decimal ps-xl" {...withoutNode(props)} />
  ),
  // The worked-example / key-rule panel: tinted surface with a 3px teal left
  // border (dagar-design § Micro-lesson).
  blockquote: (props) => (
    <blockquote
      className="bg-surface border-s-[3px] border-primary rounded-e-(--radius-control) px-lg py-md text-body text-ink"
      {...withoutNode(props)}
    />
  ),
  // Scrolls inside itself rather than widening the page (design rule 8).
  pre: (props) => (
    <pre
      className="bg-surface rounded-(--radius-control) p-md overflow-x-auto text-body-sm"
      {...withoutNode(props)}
    />
  ),
  code: (props) => <code className="font-mono text-body-sm" {...withoutNode(props)} />,
  table: (props) => (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm border-collapse" {...withoutNode(props)} />
    </div>
  ),
  th: (props) => (
    <th
      className="text-start font-medium text-ink border-b border-border py-sm pe-lg"
      {...withoutNode(props)}
    />
  ),
  td: (props) => (
    <td className="text-body border-b border-border py-sm pe-lg" {...withoutNode(props)} />
  ),
};
