import { defineTool } from "eve/tools";
import { z } from "zod";

import { captionOutput } from "@/agent/lib/tool-output";
import { getMatchResults } from "@/lib/results";
import { type GroupLetter, teamById } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

const teamName = (code: string) => teamById[code]?.name ?? code;
const percent = (p: number) => Math.round(p * 1000) / 10;

interface ThirdRow {
  rank: number;
  group: string;
  team: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  chancePercent: number; // chance of finishing in the best eight
  qualifies: boolean;
}
interface RoundOf32Matchup {
  match: number;
  host: string;
  mostLikelyThird: {
    group: string;
    team: string;
    chancePercent: number;
  } | null;
  otherPossibleThirds: { group: string; team: string; chancePercent: number }[];
}
interface ThirdsOutput {
  asOf: string;
  scenariosStillPossible: number;
  outOf: number;
  ranking: ThirdRow[];
  roundOf32Matchups: RoundOf32Matchup[];
}

function render(output: ThirdsOutput): string {
  const provisional =
    output.scenariosStillPossible < output.outOf ? " (provisional)" : "";
  const inLine = output.ranking
    .filter((r) => r.qualifies)
    .map((r) => `${r.team} (${r.group})`)
    .join(", ");
  return `Best eight thirds right now${provisional}: ${inLine || "not enough groups finished yet"}.`;
}

export default defineTool({
  description:
    "The third-place race: the twelve thirds ranked by their chance of finishing in the best eight (who completes the Round of 32), plus — for each R32 slot a third can fill — which group's third is most likely to land there. Always shows the thirds widget. Provisional until every group finishes.",
  inputSchema: z.object({}),
  async execute(): Promise<ThirdsOutput> {
    const results = await getMatchResults();
    const teamByGroup = new Map(
      results.bestThirds.map((t) => [t.group, t.teamId]),
    );

    // Each group's third fills at most one R32 slot, so its per-slot odds are
    // disjoint — summing them gives the chance of landing in the best eight.
    const chanceByGroup = new Map<string, number>();
    for (const odds of Object.values(results.thirdOdds)) {
      for (const [group, prob] of Object.entries(odds)) {
        chanceByGroup.set(group, (chanceByGroup.get(group) ?? 0) + (prob ?? 0));
      }
    }

    const ranking: ThirdRow[] = results.bestThirds.map((t) => ({
      rank: t.rank,
      group: t.group,
      team: teamName(t.teamId),
      points: t.points,
      goalDifference: t.goalDiff,
      goalsFor: t.goalsFor,
      chancePercent: percent(chanceByGroup.get(t.group) ?? 0),
      qualifies: t.qualifies,
    }));

    const roundOf32Matchups: RoundOf32Matchup[] = [...thirdPlaceSlots]
      .sort((a, b) => a.match - b.match)
      .map((slot) => {
        const candidates = Object.entries(results.thirdOdds[slot.match] ?? {})
          .map(([group, p]) => ({
            group,
            team: teamName(teamByGroup.get(group as GroupLetter) ?? group),
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
      ranking,
      roundOf32Matchups,
    };
  },
  toModelOutput: (output) => captionOutput(output, render),
});
