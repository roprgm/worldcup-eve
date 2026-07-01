import { defineTool } from "eve/tools";
import { z } from "zod";

import { percent, teamName } from "@/agent/lib/fixtures";
import { getPredictions } from "@/lib/predictions";

export default defineTool({
  description:
    "The whole predicted knockout bracket — the market's projected field, Round of 32 through the final, in one view. Call this for 'the bracket', 'the predicted bracket', or the whole knockout picture, then show a `bracket` code block (empty body); the widget lays out every slot itself. Never rebuild the bracket from `outlook` slots. For one team's route use `outlook` with the team; for a single undecided slot use `outlook` with `slot`.",
  inputSchema: z.object({}),
  async execute() {
    const snapshot = await getPredictions();
    const favorite = [...snapshot.bracketChampion].sort(
      (a, b) => b.probability - a.probability,
    )[0];
    return {
      asOf: snapshot.updatedAt,
      favorite: favorite
        ? {
            team: teamName(favorite.code),
            championPct: percent(favorite.probability),
          }
        : undefined,
    };
  },
  // Keep the model's view to a sentence — the `bracket` widget carries the full
  // field, so it never lists the matchups in prose.
  toModelOutput(output) {
    const fav = output.favorite;
    return {
      type: "text",
      value: fav
        ? `Projected bracket ready — ${fav.team} lead the field at ${fav.championPct}% to lift the cup. Show it as a \`bracket\` block.`
        : "Projected bracket ready — show it as a `bracket` block.",
    };
  },
});
