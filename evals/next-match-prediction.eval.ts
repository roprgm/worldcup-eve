import { defineEval } from "eve/evals";

import { countryPattern } from "@/evals/countries";

type MatchupPrediction = {
  type?: string;
  matchId?: number;
  favorite?: { code?: string; name?: string };
  teams?: Array<{ code?: string; name?: string; estimatedWinPercent?: number }>;
};

function hasNextMatchPrediction(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return false;
  }

  const prediction = output as MatchupPrediction;

  return (
    prediction.type === "matchup" &&
    typeof prediction.matchId === "number" &&
    typeof prediction.favorite?.name === "string" &&
    prediction.teams?.length === 2 &&
    prediction.teams.every(
      (team) => typeof team.estimatedWinPercent === "number",
    )
  );
}

export default defineEval({
  description: "Use predictions for the next match suggestion.",
  async test(t) {
    await t.send("Who is more likely to win the next match?");

    t.completed();
    t.calledTool("get_match_prediction", {
      output: hasNextMatchPrediction,
    });
    t.messageIncludes(countryPattern);
  },
});
