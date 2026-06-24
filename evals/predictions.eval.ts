import { defineEval } from "eve/evals";

import predictions from "@/data/predictions.json";

type PredictionOutput = {
  type?: string;
  teams?: Array<{ code?: string; name?: string; championPercent?: number }>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const countryPattern = new RegExp(
  predictions.teams
    .map((team) => escapeRegExp(team.name))
    .sort((a, b) => b.length - a.length)
    .join("|"),
  "i",
);

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

export default defineEval({
  description: "Use static predictions for World Cup title favorites.",
  async test(t) {
    await t.send("Who is the favorite to win the World Cup?");

    t.completed();
    t.calledTool("get_match_prediction", {
      output: hasTitleFavorite,
    });
    t.messageIncludes(countryPattern);
  },
});
