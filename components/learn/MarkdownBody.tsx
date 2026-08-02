"use client";

import Markdown from "react-markdown";
import type { PluggableList } from "unified";
import {
  markdownComponents,
  rehypePlugins,
  remarkPlugins,
} from "./markdownConfig";

/**
 * Markdown + KaTeX, rendered in the browser.
 *
 * `LessonBody` is a Server Component precisely so a lesson costs the learner HTML
 * and not a parser. **Practice cannot do that**, and the reason is worth stating
 * rather than leaving as an inconsistency: question stems after the first, and
 * every hint and worked solution, arrive from `fetch` *after* the page has
 * rendered. There is no server render left to piggyback on.
 *
 * The alternative — returning pre-rendered HTML strings from the API and injecting
 * them with `dangerouslySetInnerHTML` — was rejected. It moves an XSS-shaped hole
 * into the highest-traffic screen in the product to save a one-time chunk that the
 * service worker caches after the first practice session anyway.
 *
 * Scoped to the practice route by import, so a learner who only reads lessons
 * never downloads it.
 */
export function MarkdownBody({
  markdown,
  inline = false,
}: {
  markdown: string;
  /**
   * For text that sits INSIDE another element — an MCQ option label, most of all.
   *
   * MCQ labels are maths: the seeded options for "which fraction equals 1/2?" are
   * `$\frac{2}{4}$` and friends. Rendered as plain text a learner reads literal
   * LaTeX; rendered as a block, each option grows a paragraph and the radio row
   * breaks. This keeps KaTeX and drops the block wrapper.
   */
  inline?: boolean;
}) {
  // A SPAN when inline, not a div.
  //
  // The `p → span` override below made the CONTENT inline while the wrapper
  // stayed a block element, so every inline use produced `<div>` inside
  // whatever contained it. React flags that as a hydration error — "in HTML,
  // <div> cannot be a descendant of <p>" — and it was already true of the MCQ
  // option labels before the quiz results started using it.
  //
  // Being inline means being an inline element, wrapper included.
  const Wrapper = inline ? "span" : "div";

  return (
    <Wrapper className={inline ? "lesson-body inline" : "lesson-body flex flex-col gap-md"}>
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins as unknown as PluggableList}
        components={
          inline
            ? { ...markdownComponents, p: (props) => <span {...stripNode(props)} /> }
            : markdownComponents
        }
      >
        {markdown}
      </Markdown>
    </Wrapper>
  );
}

function stripNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}
