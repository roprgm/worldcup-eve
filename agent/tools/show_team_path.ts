import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { teamPath } from "@/lib/predictions/team-path";
import { teams } from "@/lib/tournament";

const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  FINAL: "Final",
};

const percent = (v: number) => Math.round(v * 1000) / 10;

export default defineTool({
  description:
    'Show the user a widget of a team\'s projected path to the final: the likely opponents it would meet at each knockout round (Round of 32 → Final), assuming its most likely group finish. Use for questions like "who could X face on the way to the final" or "show X\'s road to the final".',
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
    const path = teamPath(snapshot, code);
    if (!path) {
      return { error: `No projected path available for ${team}.` };
    }

    return {
      updatedAt: snapshot.updatedAt,
      code: path.code,
      team: path.name,
      group: path.group,
      placement: path.placement,
      rounds: path.steps.map((step) => ({
        round: ROUND_LABEL[step.round] ?? step.round,
        matchNumber: step.matchNumber,
        opponents: step.opponents.slice(0, 4).map((o) => ({
          team: o.name,
          chancePercent: percent(o.probability),
        })),
      })),
    };
  },
  toModelOutput: widgetModelOutput,
});
