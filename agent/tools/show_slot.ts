import { defineTool } from "eve/tools";
import { z } from "zod";

import { buildSlot, summarizeSlot } from "@/agent/lib/outlook";
import { getPredictions } from "@/lib/predictions";

export default defineTool({
  description:
    "Display the slot widget: who's likely to fill an undecided knockout match (numbers 73-104) — the field of contenders for each side. Pass the match number. Returns the candidates so you can add one short line.",
  inputSchema: z.object({
    match: z
      .number()
      .int()
      .min(73)
      .max(104)
      .describe("An undecided knockout match number (73-104)."),
  }),
  async execute({ match }) {
    const snapshot = await getPredictions();
    return buildSlot(snapshot, match);
  },
  toModelOutput(output) {
    return { type: "text", value: summarizeSlot(output) };
  },
});
