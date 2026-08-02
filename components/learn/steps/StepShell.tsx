"use client";

import { MarkdownBody } from "@/components/learn/MarkdownBody";

/**
 * The frame every step shares: prose on top, everything else underneath.
 *
 * One place, so no step kind can quietly grow its own spacing or type scale and
 * make the sequence feel like five screens from five products.
 */
export function StepShell({ md, children }: { md: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-lg">
      {/* Markdown because the prose carries inline maths — `$\frac{1}{4}$` — and
          bold. It is one or two sentences by contract, never a document. */}
      <div className="text-body text-ink">
        <MarkdownBody markdown={md} />
      </div>
      {children}
    </div>
  );
}
