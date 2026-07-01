import { defineTool } from "eve/tools";
import { z } from "zod";

import { captionOutput } from "@/agent/lib/tool-output";
import {
  buildMatchDetail,
  type Incident,
  type MatchDetail,
} from "@/lib/results/match-detail";

function incidentLine(e: Incident): string {
  const clock = e.clock?.displayValue ? `${e.clock.displayValue} ` : "";
  const kind = e.scoringPlay
    ? e.ownGoal
      ? "own goal"
      : e.penaltyKick
        ? "penalty goal"
        : "goal"
    : e.redCard
      ? "red card"
      : e.yellowCard
        ? "yellow card"
        : (e.type?.text ?? e.shortText ?? e.text ?? "event");
  const who = e.participants?.[0]?.athlete?.displayName;
  const team = e.team?.abbreviation ?? e.team?.displayName;
  const subject = [who, team].filter(Boolean).join(", ");
  return `${clock}${kind}${subject ? ` — ${subject}` : ""}`;
}

function statLine(team: NonNullable<MatchDetail["teams"]>[number]): string {
  const name = team.team?.displayName ?? team.team?.abbreviation ?? "Team";
  const stats = (team.statistics ?? [])
    .map((s) => `${s.name}: ${s.displayValue}`)
    .join(", ");
  return `${name} — ${stats}`;
}

function render(output: MatchDetail | { error: string }): string {
  if ("error" in output) return output.error;
  const clock = output.status?.displayClock ?? output.status?.type?.shortDetail;
  const timeline = output.events.length
    ? output.events.map(incidentLine).join("\n")
    : "No notable incidents recorded.";
  const stats = output.teams?.length
    ? `\n\n${output.teams.map(statLine).join("\n")}`
    : "";
  return `${clock ? `${clock}\n` : ""}${timeline}${stats}`;
}

export default defineTool({
  description:
    "Play-by-play incident timeline (goals, cards, substitutions) for one already-played or in-progress World Cup match, optionally with team stats. For the plain score, kickoff, or venue use `match` instead — this is only for the detail.",
  inputSchema: z.object({
    id: z
      .number()
      .int()
      .min(1)
      .max(104)
      .describe("World Cup match number, 1-104."),
    includeStats: z
      .boolean()
      .optional()
      .describe("Set true when asked for match or team statistics."),
  }),
  async execute({ id, includeStats }) {
    try {
      return await buildMatchDetail(id, includeStats);
    } catch {
      return { error: `No match detail available for match ${id} yet.` };
    }
  },
  toModelOutput: (output) => captionOutput(output, render),
});
