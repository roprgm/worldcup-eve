import { defineTool } from "eve/tools";
import { z } from "zod";

import { WIDGET_NOTE } from "@/agent/lib/widget-note";
import { fetchStandings, type StandingEntry } from "@/lib/results/standings";
import { type GroupLetter, groupLetters } from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

const stat = (entry: StandingEntry, name: string) =>
  entry.stats?.find((s) => s.name === name)?.displayValue;

export default defineTool({
  description:
    "Show the user a group's standings widget — the current table plus each team's predicted finish — by letter A–L. Use for any question about how a group looks or who tops it.",
  inputSchema: z.object({ group: groupLetter }),
  async execute({ group }) {
    const standings = await fetchStandings();
    const node = (standings.children ?? []).find(
      (child) => child.name === `Group ${group}`,
    );
    const table = (node?.standings?.entries ?? []).map((entry) => ({
      team: entry.team.displayName,
      position: stat(entry, "rank"),
      points: stat(entry, "points"),
      goalDifference: stat(entry, "pointDifferential"),
    }));
    return { shownAsWidget: WIDGET_NOTE, group: `Group ${group}`, table };
  },
});
