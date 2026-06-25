import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  getKnockoutSlots,
  type SlotCandidate,
} from "@/agent/lib/predictions-snapshot";

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

// One side of the slot: the single most likely team, plus a few alternatives.
function side(candidates: SlotCandidate[]) {
  const ranked = candidates.filter((candidate) => candidate.probability > 0);
  const [top, ...rest] = ranked;
  return {
    mostLikely: top
      ? { team: top.name, chancePercent: percent(top.probability) }
      : null,
    others: rest.slice(0, 3).map((candidate) => ({
      team: candidate.name,
      chancePercent: percent(candidate.probability),
    })),
  };
}

export default defineTool({
  description:
    "Likely teams to reach each side of a knockout match whose teams aren't decided yet (Round of 32 to Final), by match id. Use it whenever someone asks who plays such a match, not only who is more likely. The teams aren't settled, so present it as a prediction, leading with the single most likely team on each side and mentioning the others only if asked.",
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
      home: side(slot.home),
      away: side(slot.away),
    };
  },
});
