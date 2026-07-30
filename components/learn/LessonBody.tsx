import Markdown from "react-markdown";
import type { PluggableList } from "unified";
import {
  markdownComponents,
  rehypePlugins,
  remarkPlugins,
} from "./markdownConfig";

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
 *
 * The plugin list and element overrides are shared with the client renderer
 * (`MarkdownBody`) so the two cannot drift — see `markdownConfig.tsx`.
 */
export function LessonBody({ markdown }: { markdown: string }) {
  return (
    <div className="lesson-body flex flex-col gap-lg text-body text-ink">
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins as unknown as PluggableList}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
