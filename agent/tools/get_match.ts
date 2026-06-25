import { defineTool } from "eve/tools";
import { z } from "zod";

import { mockMatch } from "@/agent/lib/mock";

export default defineTool({
  description:
    "Display a single World Cup match as a card: teams, score, status, kickoff, and an optional win prediction. Works for group-stage and knockout matches (Round of 32, Round of 16, etc.). Use this to SHOW a match; for win-probability analysis without a card, use get_match_prediction.",
  inputSchema: z.object({
    number: z
      .number()
      .int()
      .min(1)
      .max(104)
      .optional()
      .describe("Match number, when the user asks about a specific match."),
    phase: z
      .enum([
        "group",
        "round_of_32",
        "round_of_16",
        "quarterfinal",
        "semifinal",
        "final",
      ])
      .optional()
      .describe(
        "Tournament phase, when the user asks for a match from a round.",
      ),
  }),
  async execute({ number, phase }) {
    return mockMatch({ number, phase });
  },
});
