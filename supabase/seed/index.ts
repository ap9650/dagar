import type { SeedChapter } from "./types.ts";
import { class6Fractions } from "./class6-fractions.ts";
import { class7Integers } from "./class7-integers.ts";
import { class8LinearEquations } from "./class8-linear-equations.ts";

/** Every chapter the seed runner loads — the full MVP scope (D1). */
export const chapters: SeedChapter[] = [
  class6Fractions,
  class7Integers,
  class8LinearEquations,
];
