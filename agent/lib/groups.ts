import { z } from "zod";

import { type GroupLetter, groupLetters } from "@/lib/tournament";

/** World Cup group letters, A–L (12 groups of four), sourced from the tournament module. */
export const groupLetter = z.enum(
  groupLetters as [GroupLetter, ...GroupLetter[]],
);

export type { GroupLetter };
