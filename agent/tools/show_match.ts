import { defineTool } from "eve/tools";
import { z } from "zod";

import { queryFixtures, summarizeFixtures } from "@/agent/lib/matches";

export default defineTool({
  description:
    "Display the match widget: live fixture cards (teams, kickoff in the reader's zone, stadium, status, score). Pass FIFA match numbers, or scope `today`/`live`. Returns the fixtures so you can add one short line — don't restate the kickoff, it's on the card. Prefer this over a bare `matches` call whenever the answer is a schedule, result, or a game between two named teams.",
  inputSchema: z
    .object({
      numbers: z
        .array(z.number().int().min(1).max(104))
        .optional()
        .describe("FIFA match numbers (1-104) to show."),
      scope: z
        .enum(["today", "live"])
        .optional()
        .describe("Show all of today's or all in-progress matches."),
    })
    .refine((v) => v.scope || (v.numbers && v.numbers.length > 0), {
      message: "Pass match numbers or a scope (today/live).",
    }),
  async execute({ numbers, scope }) {
    if (scope === "today") return queryFixtures({ when: "today" });
    if (scope === "live") return queryFixtures({ status: "live" });
    return queryFixtures({ matches: numbers });
  },
  toModelOutput(output) {
    return {
      type: "text",
      value: output.note ?? summarizeFixtures(output.matches),
    };
  },
});
