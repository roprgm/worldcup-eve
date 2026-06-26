import { defineTool } from "eve/tools";
import { z } from "zod";

import { getMatchResults } from "@/lib/results";
import { teamById } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

const teamName = (code: string) => teamById[code]?.name ?? code;
const percent = (p: number) => Math.round(p * 1000) / 10;

export default defineTool({
  description:
    "Round-of-32 matchup detail for the third-place race: which R32 match each qualifying third is heading to, the chance of every still-possible third in each slot, and how many of FIFA's 495 third-place combinations remain mathematically possible. Use it when someone asks who a specific group winner will face among the thirds, or how settled the picture is. For the ranking of the twelve thirds by qualification chance (who is in or out), use show_thirds_ranking instead. Everything is provisional until the groups finish.",
  inputSchema: z.object({}),
  async execute() {
    const results = await getMatchResults();
    const teamByGroup = new Map<string, string>(
      results.bestThirds.map((t) => [t.group, t.teamId]),
    );

    const ranking = results.bestThirds.map((t) => ({
      rank: t.rank,
      group: t.group,
      team: teamName(t.teamId),
      points: t.points,
      goalDifference: t.goalDiff,
      goalsFor: t.goalsFor,
      qualifies: t.qualifies,
    }));

    const roundOf32Matchups = [...thirdPlaceSlots]
      .sort((a, b) => a.match - b.match)
      .map((slot) => {
        const candidates = Object.entries(results.thirdOdds[slot.match] ?? {})
          .map(([group, p]) => ({
            group,
            team: teamName(teamByGroup.get(group) ?? group),
            chancePercent: percent(p ?? 0),
          }))
          .filter((c) => c.chancePercent > 0)
          .sort((a, b) => b.chancePercent - a.chancePercent);
        const [mostLikely, ...others] = candidates;
        return {
          match: slot.match,
          host: `winner of Group ${slot.winner}`,
          mostLikelyThird: mostLikely ?? null,
          otherPossibleThirds: others,
        };
      });

    return {
      asOf: results.updatedAt,
      scenariosStillPossible: results.thirdCombosPossible,
      outOf: 495,
      note: "Provisional until every group finishes. The best eight third-placed teams (qualifies = true) take the eight third-place slots. Chances are uniform over the third-place combinations still mathematically reachable — no betting market.",
      ranking,
      roundOf32Matchups,
    };
  },
});
