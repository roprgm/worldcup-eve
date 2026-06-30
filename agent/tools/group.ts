import { defineTool } from "eve/tools";
import { z } from "zod";

import { captionOutput } from "@/agent/lib/tool-output";
import { getPredictions } from "@/lib/predictions";
import { fetchStandings, type StandingEntry } from "@/lib/results/standings";
import { type GroupLetter, groupLetters } from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);
const percent = (v: number) => Math.round(v * 1000) / 10;
const stat = (entry: StandingEntry, name: string) =>
  entry.stats?.find((s) => s.name === name)?.displayValue;
const isQualified = (entry: StandingEntry) =>
  (entry.stats?.find((s) => s.name === "advanced")?.value ?? 0) > 0;

interface GroupRow {
  code?: string;
  team: string;
  position?: string;
  points?: string;
  goalDifference?: string;
  alreadyQualified: boolean;
  predicted?: {
    winGroupPercent: number;
    runnerUpPercent: number;
    advancePercent: number;
  };
}
type GroupOutput =
  | { type: "qualified_overview"; qualified: { group: string; team: string }[] }
  | { type: "table"; group: string; table: GroupRow[] }
  | { error: string };

function render(output: GroupOutput): string {
  if ("error" in output) return output.error;
  if (output.type === "qualified_overview") {
    if (output.qualified.length === 0)
      return "No team has clinched a knockout spot yet.";
    return `Qualified so far: ${output.qualified.map((q) => `${q.team} (${q.group})`).join(", ")}.`;
  }
  const order = output.table
    .map(
      (t) =>
        `${t.team}${t.position ? ` (${t.position})` : ""}${t.predicted ? ` advance ${t.predicted.advancePercent}%` : ""}`,
    )
    .join(", ");
  return `${output.group}: ${order}.`;
}

export default defineTool({
  description:
    "A group's real standings combined with predicted final-order odds, by letter A-L. Always shows the group table widget. Omit `group` to instead get which teams across all 12 groups have already clinched a knockout spot, no widget.",
  inputSchema: z.object({
    group: groupLetter.optional().describe("Group letter, A-L."),
    qualifiedOnly: z
      .boolean()
      .optional()
      .describe(
        "Set true to get just who's already qualified, not the full table.",
      ),
  }),
  async execute({ group, qualifiedOnly }): Promise<GroupOutput> {
    const standings = await fetchStandings();

    if (!group) {
      const qualified = (standings.children ?? []).flatMap((node) =>
        (node.standings?.entries ?? []).filter(isQualified).map((e) => ({
          group: node.name ?? "?",
          team: e.team.displayName ?? e.team.abbreviation ?? "?",
        })),
      );
      return { type: "qualified_overview", qualified };
    }

    const node = (standings.children ?? []).find(
      (c) => c.name === `Group ${group}`,
    );
    if (!node)
      return { error: `No standings available for Group ${group} yet.` };

    const predictions = qualifiedOnly ? undefined : await getPredictions();
    const groupOdds = predictions?.groups.find((g) => g.letter === group);

    const table: GroupRow[] = (node.standings?.entries ?? []).map((entry) => {
      const code = entry.team.abbreviation;
      const predicted = groupOdds?.teams.find((t) => t.code === code);
      return {
        code,
        team: entry.team.displayName ?? code ?? "?",
        position: stat(entry, "rank"),
        points: stat(entry, "points"),
        goalDifference: stat(entry, "pointDifferential"),
        alreadyQualified: isQualified(entry),
        predicted: predicted
          ? {
              winGroupPercent: percent(predicted.first),
              runnerUpPercent: percent(predicted.second),
              advancePercent: percent(predicted.advance),
            }
          : undefined,
      };
    });

    return {
      type: "table",
      group: `Group ${group}`,
      table: qualifiedOnly ? table.filter((t) => t.alreadyQualified) : table,
    };
  },
  toModelOutput: (output) => captionOutput(output, render),
});
