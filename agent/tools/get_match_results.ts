import { defineTool } from "eve/tools";
import { z } from "zod";

import { loadMatchResults } from "@/agent/lib/match-results";

const tournamentDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);

export default defineTool({
  description:
    "Scores, live status, and the day's fixtures for World Cup matches — use it for what's playing today, live now, or how matches ended. Filters are optional and combine.",
  inputSchema: z.object({
    status: z
      .enum(["scheduled", "live", "final"])
      .optional()
      .describe("Filter by match state."),
    from: tournamentDate
      .optional()
      .describe(
        "Earliest kickoff by tournament-day date, as YYYY-MM-DD or YYYY-MM-DDTHH:MM.",
      ),
    to: tournamentDate
      .optional()
      .describe(
        "Latest kickoff by tournament-day date, as YYYY-MM-DD or YYYY-MM-DDTHH:MM.",
      ),
  }),
  async execute({ status, from, to }) {
    return loadMatchResults({ status, from, to });
  },
});
