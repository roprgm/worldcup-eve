import { defineTool } from "eve/tools";
import { z } from "zod";

import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const FINAL_MATCH = 104; // the bracket's final node (see bracket-card)

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

export default defineTool({
  description:
    "Show the user the prediction bracket widget: the whole knockout bracket (Round of 32 to Final) with each slot's most-likely team and its chance to reach that match. Use for any question about the predicted bracket or knockout path as a whole. For a single match use show_knockout_match instead.",
  inputSchema: z.object({}),
  async execute() {
    const snapshot = await getPredictions();

    // The widget shows each slot's most-likely team and that team's chance to
    // REACH the match — not to win the cup. Summarise the final the same way.
    const finalist = (side: "home" | "away") => {
      const top = snapshot.slots.find(
        (s) => s.match === FINAL_MATCH && s.side === side,
      )?.candidates[0];
      return top
        ? {
            team: teamName(top.code),
            chanceToReachFinalPercent: percent(top.probability),
          }
        : undefined;
    };

    return { final: { home: finalist("home"), away: finalist("away") } };
  },
  toModelOutput: widgetModelOutput,
});
