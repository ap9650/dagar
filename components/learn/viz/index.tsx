"use client";

import { NumberLine } from "./NumberLine";
import { PartWhole } from "./PartWhole";
import type { VizSpec } from "./types";

/**
 * The single place the `VizSpec` union is resolved.
 *
 * Every caller renders `<Viz spec={…}/>` and nothing else imports the shapes
 * directly. That keeps the "unknown kind" case in one file — and it must never
 * throw: a content mistake in a seed file has to degrade to no picture, not to a
 * blank lesson (spec §10).
 */
export function Viz({ spec, className }: { spec: VizSpec; className?: string }) {
  switch (spec.kind) {
    case "partWhole":
      return <PartWhole spec={spec} className={className} />;
    case "numberLine":
      return <NumberLine spec={spec} className={className} />;
    default:
      // Unreachable while the union is exhaustive; reachable the moment a seed
      // file names a shape that has not been built yet.
      return null;
  }
}

export { PartWhole } from "./PartWhole";
export { NumberLine } from "./NumberLine";
export * from "./types";
