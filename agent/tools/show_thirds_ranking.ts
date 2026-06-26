import { defineTool } from "eve/tools";
import { z } from "zod";

import { getMatchResults } from "@/lib/results";
import { teamById } from "@/lib/tournament";

const percent = (p: number) => Math.round(p * 1000) / 10;

export default defineTool({
  description:
    "Show the user a widget ranking the twelve third-placed teams by their chance of finishing in the best eight (who completes the Round of 32). Use for any question about the third-place race — who is in or out, or a team's chance. For which R32 match a third heads to, use get_best_thirds instead.",
  inputSchema: z.object({}),
  async execute() {
    const results = await getMatchResults();

    // Each group's third fills at most one R32 slot, so its per-slot odds are
    // disjoint — summing them gives the chance of landing in the best eight.
    const chanceByGroup = new Map<string, number>();
    for (const odds of Object.values(results.thirdOdds)) {
      for (const [group, prob] of Object.entries(odds)) {
        chanceByGroup.set(group, (chanceByGroup.get(group) ?? 0) + (prob ?? 0));
      }
    }

    const ranking = results.bestThirds
      .map((t) => ({
        team: teamById[t.teamId]?.name ?? t.teamId,
        group: t.group,
        chancePercent: percent(chanceByGroup.get(t.group) ?? 0),
        qualifies: t.qualifies,
      }))
      .sort((a, b) => b.chancePercent - a.chancePercent);

    return {
      shownAsWidget: "Shown to the user as a widget — don't re-list it.",
      ranking,
    };
  },
});
