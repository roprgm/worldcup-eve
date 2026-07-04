import { defineTool } from "eve/tools";
import { z } from "zod";

import { buildBracket, summarizeBracket } from "@/agent/lib/outlook";
import { getPredictions } from "@/lib/predictions";

export default defineTool({
  description:
    "Display the whole projected bracket widget: the market's most likely team for every knockout slot through the final. Takes no parameters — one call covers every round. Returns a summary so you can add one short line.",
  inputSchema: z.object({}),
  async execute() {
    const snapshot = await getPredictions();
    return buildBracket(snapshot);
  },
  toModelOutput(output) {
    return { type: "text", value: summarizeBracket(output) };
  },
});
