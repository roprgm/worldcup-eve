import { z } from "zod";

/** World Cup group letters, A–L (12 groups of four). */
export const groupLetter = z.enum([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
]);

export type GroupLetter = z.infer<typeof groupLetter>;
