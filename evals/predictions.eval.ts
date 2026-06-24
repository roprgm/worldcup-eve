import { defineEval } from "eve/evals";

import { countryPattern } from "@/evals/countries";

type PredictionOutput = {
  type?: string;
  teams?: Array<{ code?: string; name?: string; championPercent?: number }>;
};

function hasTitleFavorite(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return false;
  }

  const prediction = output as PredictionOutput;
  const topTeam = prediction.teams?.[0];

  return (
    prediction.type === "title_ranking" &&
    typeof topTeam?.name === "string" &&
    typeof topTeam.code === "string" &&
    typeof topTeam.championPercent === "number"
  );
}

function assertNoMarkdownTable(message: string | null | undefined): void {
  if (message?.split("\n").some((line) => line.trim().startsWith("|"))) {
    throw new Error("Prediction reply should not use markdown tables.");
  }
}

export default defineEval({
  description: "Use static predictions for World Cup title favorites.",
  async test(t) {
    const turn = await t.send("Who is the favorite to win the World Cup?");

    t.completed();
    t.calledTool("get_match_prediction", {
      output: hasTitleFavorite,
    });
    t.messageIncludes(countryPattern);
    assertNoMarkdownTable(turn.message);
  },
});
