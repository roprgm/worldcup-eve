import { defineTool } from "eve/tools";
import { z } from "zod";

import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

export default defineTool({
  description:
    'Show the user the road-to-the-final widget: ONE table covering EVERY remaining team at once, with each team\'s chance to reach each knockout round (Round of 32 → Final) and to win the cup, ranked by title odds. Use ONLY when the question is about the whole field together — e.g. "every team\'s chance to reach the final", "all teams\' odds to win the cup", "the road to the final for everyone". Do NOT use it for one or a few named teams (use show_team_path), nor for the bracket matchups layout (use show_bracket).',
  inputSchema: z.object({}),
  async execute() {
    const snapshot = await getPredictions();

    // Title-odds leaders only — a one-line caption; the widget shows the full
    // table, so there's no need to list every team here.
    const favorites = [...snapshot.reach]
      .sort((a, b) => b.mktChampion - a.mktChampion)
      .slice(0, 5)
      .map((t) => ({
        team: teamName(t.code),
        winCupPercent: percent(t.mktChampion),
        reachFinalPercent: percent(t.final),
      }));

    return { favorites };
  },
  toModelOutput: widgetModelOutput,
});
