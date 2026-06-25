import { defineTool } from "eve/tools";
import { z } from "zod";

import { mockGroup } from "@/agent/lib/mock";

const groupLetter = z.enum([
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

export default defineTool({
  description:
    "Display a World Cup group as a table card: standings with predicted, live, and final results for each matchup, goal difference, points, and who advances.",
  inputSchema: z.object({
    group: groupLetter.optional().describe("Group letter, A–L."),
  }),
  async execute({ group }) {
    return mockGroup(group);
  },
});
