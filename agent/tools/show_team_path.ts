import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { outMessage, teamPath } from "@/lib/predictions/team-path";
import { teams } from "@/lib/tournament";

const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  FINAL: "Final",
};

const percent = (v: number) => Math.round(v * 100);

export default defineTool({
  description:
    'Show the user a widget of a team\'s projected path to the final: the likely opponents it would meet at each knockout round (Round of 32 → Final). Use for questions like "who could X face on the way to the final" or "show X\'s road to the final".',
  inputSchema: z.object({
    team: z.string().describe("A country name or code, e.g. Argentina or ARG."),
  }),
  async execute({ team }) {
    const code = codeFor(team);
    if (!code) {
      return {
        error: "Unknown team.",
        requested: { team },
        knownTeams: teams.map((t) => t.name),
      };
    }

    const snapshot = await getPredictions();
    const result = teamPath(snapshot, code);
    if (!result) {
      return { error: `No projected path available for ${team}.` };
    }
    if (result.status === "out") {
      // A real "this team is done" answer — no widget, just the note.
      return { note: outMessage(result) };
    }

    // Compact, one-line-per-round content: enough for a caption, small enough
    // that the model just summarizes it instead of re-listing every candidate.
    return {
      team: result.name,
      group: result.group,
      rounds: result.steps.map((step) => ({
        round: ROUND_LABEL[step.round] ?? step.round,
        reachPercent: percent(step.reachProbability),
        possibleOpponents: step.opponents
          .slice(0, 4)
          .map((o) => `${o.name} (${percent(o.probability)}%)`),
      })),
    };
  },
  toModelOutput: widgetModelOutput,
});
