import { defineTool } from "eve/tools";
import { z } from "zod";

import { eventIdForMatch, fetchSummary } from "@/agent/lib/espn";

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
  async execute({ id, includeStats }) {
    const summary = await fetchSummary(eventIdForMatch(id));
    const competition = summary.header?.competitions?.[0];
    if (!competition) throw new Error(`No competition found for match ${id}`);

    return {
      id,
      status: competition.status,
      events: summary.keyEvents?.length
        ? summary.keyEvents
        : (competition.details ?? []),
      ...(includeStats
        ? {
            teams:
              summary.boxscore?.teams?.map(({ team, statistics }) => ({
                team,
                statistics,
              })) ?? [],
          }
        : {}),
    };
  },
});
