import { defineTool } from "eve/tools";
import { z } from "zod";

import { buildMatchDetail } from "@/lib/results/match-detail";

export default defineTool({
  description:
    "Incident timeline for one World Cup match by id. Can also include team stats.",
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
