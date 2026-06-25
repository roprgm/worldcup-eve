// Resolve a free-text country name or code to a FIFA code. Team names and codes
// are static (from the tournament module); the prediction and forecast tools
// share this so a user can type "Korea", "USA", "Türkiye", etc.

import { teams as tournamentTeams } from "@/lib/tournament";

const extraAliases: Record<string, string> = {
  bosnia: "BIH",
  "bosnia and herzegovina": "BIH",
  "cabo verde": "CPV",
  "cape verde": "CPV",
  "cote divoire": "CIV",
  curacao: "CUW",
  "czech republic": "CZE",
  "democratic republic of congo": "COD",
  "dr congo": "COD",
  holland: "NED",
  "ivory coast": "CIV",
  korea: "KOR",
  mexico: "MEX",
  "south korea": "KOR",
  turkey: "TUR",
  turkiye: "TUR",
  "u s": "USA",
  "u s a": "USA",
  "united states": "USA",
  "united states of america": "USA",
  usa: "USA",
};

function lookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const codeByAlias = new Map<string, string>();
for (const team of tournamentTeams) {
  codeByAlias.set(lookupKey(team.id), team.id);
  codeByAlias.set(lookupKey(team.name), team.id);
}
for (const [alias, code] of Object.entries(extraAliases)) {
  codeByAlias.set(lookupKey(alias), code);
}

export function codeFor(value?: string | null): string | undefined {
  return value ? codeByAlias.get(lookupKey(value)) : undefined;
}
