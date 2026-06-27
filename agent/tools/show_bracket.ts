import { defineTool } from "eve/tools";
import { z } from "zod";

import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

export default defineTool({
  description:
    "Show the user the prediction bracket widget: the whole knockout bracket (Round of 32 to Final) with each slot's most-likely team and its chance to reach that match. Use for any question about the predicted bracket or knockout path as a whole. For a single match use show_knockout_match instead.",
  inputSchema: z.object({}),
  async execute() {
    const snapshot = await getPredictions();
    const champion = snapshot.champion.slice(0, 3).map((c) => ({
      team: teamName(c.code),
      chancePercent: percent(c.probability),
    }));
    return { champion };
  },
  toModelOutput: widgetModelOutput,
});
