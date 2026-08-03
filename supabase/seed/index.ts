import type { SeedChapter } from "./types.ts";
import { class6DataHandling } from "./class6-data-handling.ts";
import { class6Fractions } from "./class6-fractions.ts";
import { class7Integers } from "./class7-integers.ts";
import { class7NumberPlay } from "./class7-number-play.ts";
import { class8LinearEquations } from "./class8-linear-equations.ts";

/**
 * Every chapter the seed runner loads.
 *
 * Order here does not decide what a learner sees — `order_index` on each
 * chapter does, and it follows the Ganita Prakash chapter numbers so a learner
 * meets them in the order their own book does.
 */
export const chapters: SeedChapter[] = [
  class6DataHandling,
  class6Fractions,
  class7NumberPlay,
  class7Integers,
  class8LinearEquations,
];
