import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  getKnockoutSlots,
  type SlotCandidate,
} from "@/agent/lib/predictions-snapshot";

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

// Top likely teams for one side of a knockout slot, as chance percentages.
function chances(candidates: SlotCandidate[]) {
  return candidates
    .filter((candidate) => candidate.probability > 0)
    .slice(0, 6)
    .map((candidate) => ({
      code: candidate.code,
      name: candidate.name,
      chancePercent: percent(candidate.probability),
    }));
}

export default defineTool({
  description:
    "Likely teams to reach each side of an undecided knockout match (Round of 32 to Final), by match id.",
  inputSchema: z.object({
    id: z
      .number()
      .int()
      .min(73)
      .max(104)
      .describe("Knockout match id, 73-104."),
  }),
  async execute({ id }) {
    const { updatedAt, slots } = await getKnockoutSlots();
    const slot = slots[id];
    if (!slot) {
      return {
        updatedAt,
        matchId: id,
        error: "No prediction available for this match.",
      };
    }
    return {
      updatedAt,
      matchId: id,
      home: chances(slot.home),
      away: chances(slot.away),
      note: "Likely teams for each side, from the prediction model.",
    };
  },
});
