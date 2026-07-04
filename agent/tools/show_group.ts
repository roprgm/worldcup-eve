import { defineTool } from "eve/tools";
import { z } from "zod";

import { groupTables, summarizeGroups } from "@/agent/lib/standings";
import { type GroupLetter, groupLetters } from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

export default defineTool({
  description:
    "Display the group table widget for one group: standings, points, and who's through. Pass the group letter (A-L). Returns the table so you can add one short line. Prefer this over a bare `standings` call whenever the answer is a group's table.",
  inputSchema: z.object({
    group: groupLetter.describe("The group letter, A-L."),
  }),
  async execute({ group }) {
    return groupTables([group]);
  },
  toModelOutput(output) {
    return { type: "text", value: summarizeGroups(output) };
  },
});
