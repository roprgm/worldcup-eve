import { defineTool } from "eve/tools";
import { z } from "zod";

import { fetchStandings, type StandingEntry } from "@/agent/lib/espn";
import { groupLetter } from "@/agent/lib/groups";

const statNames = new Set(
  "rank points gamesPlayed wins ties losses pointsFor pointsAgainst pointDifferential overall".split(
    " ",
  ),
);

function stat(entry: StandingEntry, name: string) {
  return entry.stats?.find((stat) => stat.name === name);
}

function compactEntry(entry: StandingEntry) {
  return {
    team: {
      abbreviation: entry.team.abbreviation,
      displayName: entry.team.displayName,
    },
    alreadyQualified: (stat(entry, "advanced")?.value ?? 0) > 0,
    stats: Object.fromEntries(
      (entry.stats ?? []).flatMap(({ name, displayValue }) =>
        name && statNames.has(name) ? [[name, displayValue]] : [],
      ),
    ),
  };
}

export default defineTool({
  description:
    "Current World Cup group standings and teams already qualified for the knockout stage.",
  inputSchema: z.object({
    group: groupLetter.optional().describe("Optional group letter, A-L."),
    qualifiedOnly: z
      .boolean()
      .optional()
      .describe(
        "Set true when the user only asks which teams already qualified.",
      ),
  }),
  async execute({ group, qualifiedOnly }) {
    const standings = await fetchStandings();
    const groups = (standings.children ?? [])
      .filter((item) => !group || item.name === `Group ${group}`)
      .map((item) => ({
        group: item.name,
        teams: (item.standings?.entries ?? []).map(compactEntry),
      }));
    const qualified = groups.flatMap(({ group, teams }) =>
      teams
        .filter((team) => team.alreadyQualified)
        .map(({ team }) => ({ group, team })),
    );

    return { groups: qualifiedOnly ? [] : groups, qualified };
  },
});
