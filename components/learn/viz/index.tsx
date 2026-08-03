"use client";

import { BalanceScale } from "./BalanceScale";
import { Chart } from "./Chart";
import { NumberGrid } from "./NumberGrid";
import { NumberLine } from "./NumberLine";
import { PartWhole } from "./PartWhole";
import { TokenRow } from "./TokenRow";
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
    case "tokenRow":
      return <TokenRow spec={spec} className={className} />;
    case "balanceScale":
      return <BalanceScale spec={spec} className={className} />;
    case "chart":
      return <Chart spec={spec} className={className} />;
    case "numberGrid":
      return <NumberGrid spec={spec} className={className} />;
    default:
      // Unreachable while the union is exhaustive; reachable the moment a seed
      // file names a shape that has not been built yet.
      return null;
  }
}

export { PartWhole } from "./PartWhole";
export { NumberLine } from "./NumberLine";
export { TokenRow } from "./TokenRow";
export { BalanceScale } from "./BalanceScale";
export { Chart } from "./Chart";
export { NumberGrid } from "./NumberGrid";
export * from "./types";
