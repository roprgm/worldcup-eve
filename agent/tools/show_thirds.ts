import { defineTool } from "eve/tools";
import { z } from "zod";

import { summarizeThirds, thirdsRace } from "@/agent/lib/standings";

export default defineTool({
  description:
    "Display the third-place race widget: the twelve third-placed teams ranked by their chance of taking one of the eight Round-of-32 slots. Takes no parameters. Returns the ranking so you can add one short line.",
  inputSchema: z.object({}),
  async execute() {
    return thirdsRace();
  },
  toModelOutput(output) {
    return { type: "text", value: summarizeThirds(output) };
  },
});
