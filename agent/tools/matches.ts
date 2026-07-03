import { defineTool } from "eve/tools";
import { z } from "zod";

import { queryFixtures } from "@/agent/lib/matches";

export default defineTool({
  description:
    "World Cup fixtures and results: who plays whom, kickoff, stadium, status, final score. Any schedule, fixture, result, venue, today/live, or date-range question — including a game between two named teams. For goals and cards use timeline instead. To DISPLAY the fixtures, prefer the `show_match` widget tool, which returns the same rows. Use this when you only need them in prose.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("Only matches involving this team (name or FIFA code)."),
    matches: z
      .array(z.number().int())
      .optional()
      .describe("Only these FIFA match numbers (1-104)."),
    venue: z
      .string()
      .optional()
      .describe("Only matches at this stadium or city (substring)."),
    status: z
      .enum(["scheduled", "live", "final"])
      .optional()
      .describe("Only matches in this state."),
    when: z
      .enum(["today", "next", "upcoming", "past"])
      .optional()
      .describe(
        "Only today's, the soonest future kickoff (next), still-upcoming, or already-played matches.",
      ),
    from: z
      .string()
      .optional()
      .describe("Only matches on or after this date (YYYY-MM-DD), inclusive."),
    to: z
      .string()
      .optional()
      .describe("Only matches on or before this date (YYYY-MM-DD), inclusive."),
  }),
  async execute(filters) {
    return queryFixtures(filters);
  },
});
