import { defineTool } from "eve/tools";
import { z } from "zod";

import { buildMatchDetail } from "@/lib/results/match-detail";

export default defineTool({
  description:
    "Play-by-play incident timeline (goals, cards, substitutions) for one World Cup match by id, optionally with team stats. Not for the plain score — use get_match_results for that.",
  inputSchema: z.object({
    id: z.number().int().min(1).max(104).describe("World Cup match id, 1-104."),
    includeStats: z
      .boolean()
      .optional()
      .describe("Set true when the user asks for match or team statistics."),
  }),
  execute({ id, includeStats }) {
    return buildMatchDetail(id, includeStats);
  },
});
