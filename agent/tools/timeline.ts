import { defineTool } from "eve/tools";
import { z } from "zod";

import { buildMatchDetail } from "@/lib/results/match-detail";

// Cap how many incident timelines we fetch (one ESPN call each).
const MAX_TIMELINES = 4;

export default defineTool({
  description:
    "Goals, cards, and substitutions for one or more played or live matches, by FIFA match number (look numbers up with matches first if you only have team names). Answered in prose, no widget. For the schedule or score itself, use matches.",
  inputSchema: z.object({
    matches: z
      .array(z.number().int().min(1).max(104))
      .min(1)
      .max(MAX_TIMELINES)
      .describe(`FIFA match numbers (1-104), up to ${MAX_TIMELINES}.`),
  }),
  async execute({ matches }) {
    const timelines = await Promise.all(
      matches.map(async (number) => {
        try {
          const detail = await buildMatchDetail(number);
          return { number, events: detail.events };
        } catch {
          return { number, error: "No timeline available for this match." };
        }
      }),
    );
    return { timelines };
  },
});
