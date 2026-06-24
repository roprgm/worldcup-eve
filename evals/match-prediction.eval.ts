import { defineEval } from "eve/evals";

import { countryPattern } from "@/evals/countries";

type PredictionOutput = {
  type?: string;
  favorite?: { code?: string; name?: string };
  teams?: Array<{ code?: string; estimatedWinPercent?: number }>;
};

function hasMatchupPrediction(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return false;
  }

  const prediction = output as PredictionOutput;
  const codes = new Set(prediction.teams?.map((team) => team.code));

  return (
    prediction.type === "matchup" &&
    typeof prediction.favorite?.code === "string" &&
    typeof prediction.favorite.name === "string" &&
    codes.has("ARG") &&
    codes.has("ENG") &&
    prediction.teams?.every(
      (team) => typeof team.estimatedWinPercent === "number",
    ) === true
  );
}

export default defineEval({
  description: "Use static predictions for a likely-winner question.",
  async test(t) {
    await t.send("Who is more likely to win, Argentina or England?");

    t.completed();
    t.calledTool("get_match_prediction", {
      output: hasMatchupPrediction,
    });
    t.messageIncludes(countryPattern);
  },
});
