import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { captionOutput } from "@/agent/lib/tool-output";
import { getPredictions } from "@/lib/predictions";
import { outMessage, teamPath } from "@/lib/predictions/team-path";
import { fetchStandings, type StandingEntry } from "@/lib/results/standings";
import { teamById, teams } from "@/lib/tournament";

const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  FINAL: "Final",
};

const percent = (v: number) => Math.round(v * 1000) / 10;
const stat = (entry: StandingEntry, name: string) =>
  entry.stats?.find((s) => s.name === name)?.displayValue;

interface CurrentStanding {
  position?: string;
  points?: string;
  goalDifference?: string;
  alreadyQualified: boolean;
}

async function currentStanding(
  code: string,
): Promise<CurrentStanding | undefined> {
  const group = teamById[code]?.group;
  if (!group) return undefined;
  const standings = await fetchStandings();
  const node = (standings.children ?? []).find(
    (c) => c.name === `Group ${group}`,
  );
  const entry = (node?.standings?.entries ?? []).find(
    (e) => e.team.abbreviation === code,
  );
  if (!entry) return undefined;
  return {
    position: stat(entry, "rank"),
    points: stat(entry, "points"),
    goalDifference: stat(entry, "pointDifferential"),
    alreadyQualified:
      (entry.stats?.find((s) => s.name === "advanced")?.value ?? 0) > 0,
  };
}

interface TeamOutlook {
  team: string;
  group: string;
  currentStanding?: CurrentStanding;
  dependsOnGroupFinish: boolean;
  groupStage?: {
    winGroupPercent: number;
    runnerUpPercent: number;
    advancePercent: number;
  };
  championPercent: number;
  rounds: {
    round: string;
    reachPercent: number;
    likelyOpponent: string;
    venue: string;
  }[];
}
type TeamOutput =
  | TeamOutlook
  | { note: string; team: string }
  | { error: string };

function render(output: TeamOutput): string {
  if ("error" in output || "note" in output)
    return "error" in output ? output.error : output.note;
  const standing = output.currentStanding
    ? `${output.currentStanding.position ?? "?"} in Group ${output.group} (${output.currentStanding.points ?? "?"} pts)`
    : `Group ${output.group}`;
  const advance = output.groupStage
    ? `${output.groupStage.advancePercent}% to advance, `
    : "";
  return `${output.team} — ${standing}: ${advance}${output.championPercent}% to win it all.`;
}

export default defineTool({
  description:
    "A team's full World Cup outlook in one call: current group position, predicted group-stage odds, round-by-round likely opponent + venue + reach %, and title odds. Always shows the team's path widget. Use for any single-team question — how they're doing, their chances to advance or win it, who they might face next, or where they play each round.",
  inputSchema: z.object({
    team: z.string().describe("A country name or code, e.g. Argentina or ARG."),
  }),
  async execute({ team }): Promise<TeamOutput> {
    const code = codeFor(team);
    if (!code) {
      const sample = teams
        .slice(0, 8)
        .map((t) => t.name)
        .join(", ");
      return {
        error: `Unknown team "${team}". Known teams include: ${sample}.`,
      };
    }

    const [snapshot, standing] = await Promise.all([
      getPredictions(),
      currentStanding(code).catch(() => undefined),
    ]);
    const result = teamPath(snapshot, code);
    if (!result) return { error: `No projection available for ${team}.` };
    if (result.status === "out")
      return { note: outMessage(result), team: result.name };

    const groupOdds = snapshot.groups
      .find((g) => g.letter === result.group)
      ?.teams.find((t) => t.code === code);
    const championPercent = percent(
      snapshot.reach.find((r) => r.code === code)?.mktChampion ?? 0,
    );

    return {
      team: result.name,
      group: result.group,
      currentStanding: standing,
      dependsOnGroupFinish: result.dependsOnGroup,
      groupStage: groupOdds
        ? {
            winGroupPercent: percent(groupOdds.first),
            runnerUpPercent: percent(groupOdds.second),
            advancePercent: percent(groupOdds.advance),
          }
        : undefined,
      championPercent,
      rounds: result.steps.map((step) => ({
        round: ROUND_LABEL[step.round] ?? step.round,
        reachPercent: percent(step.reachProbability),
        likelyOpponent: step.opponents[0]
          ? `${step.opponents[0].name} (${percent(step.opponents[0].probability)}%)`
          : "to be decided",
        venue: step.venues.length
          ? step.venues
              .map((v) =>
                step.venues.length > 1
                  ? `${v.venue} (${percent(v.probability)}%)`
                  : v.venue,
              )
              .join(", ")
          : "to be decided",
      })),
    };
  },
  toModelOutput: (output) => captionOutput(output, render),
});
