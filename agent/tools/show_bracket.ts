import { defineTool } from "eve/tools";
import { z } from "zod";

import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const FINAL_MATCH = 104; // the bracket's final node

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

export default defineTool({
  description:
    "Show the user the prediction bracket widget: the entire knockout draw (Round of 32 to Final) drawn as a circular bracket. It shows the matchup STRUCTURE — which teams are in each half, who feeds into whom, and the path inward to the Final — and tapping any match reveals the teams that could reach it. Use this when the user wants to SEE the bracket, the draw, the knockout tree, its overall shape, or who could meet or cross whom across the field. Do NOT use it to say how LIKELY teams are to reach a round or win the cup, or to rank the favourites — that is show_stage_odds (a per-team odds table). For one team's specific opponents and venues use show_team_path; for a single match use show_knockout_match.",
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
