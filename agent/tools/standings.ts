import { defineTool } from "eve/tools";
import { z } from "zod";

import { groupTables, thirdsRace } from "@/agent/lib/standings";
import { type GroupLetter, groupLetters } from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

export default defineTool({
  description:
    "World Cup group tables and the third-place race. Pass group letters for those standings (one call covers several; omit for all twelve), or thirds:true for the twelve third-placed teams ranked by Round-of-32 chance. To DISPLAY either, prefer the matching `show_group` / `show_thirds` widget tool, which returns the same gist. Use this when you only need the numbers in prose.",
  inputSchema: z.object({
    groups: z
      .array(groupLetter)
      .optional()
      .describe("Group letters, A-L. Omit for all twelve groups."),
    thirds: z
      .boolean()
      .optional()
      .describe("Set true for the third-place qualification race."),
  }),
  async execute({ groups: letters, thirds }) {
    if (thirds) return thirdsRace();
    return groupTables(letters);
  },
});
