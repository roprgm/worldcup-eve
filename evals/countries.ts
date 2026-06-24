import predictions from "@/data/predictions.json";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive matcher for any World Cup country name, ordered longest-first
 * so multi-word names win over shorter substrings. Prediction evals use it to
 * assert the reply actually names a team.
 */
export const countryPattern = new RegExp(
  predictions.teams
    .map((team) => escapeRegExp(team.name))
    .sort((a, b) => b.length - a.length)
    .join("|"),
  "i",
);
