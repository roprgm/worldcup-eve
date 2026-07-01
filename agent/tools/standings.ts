import { defineTool } from "eve/tools";
import { z } from "zod";

import { fetchStandings, type StandingEntry } from "@/lib/results/standings";
import { getMatchResults } from "@/lib/results";
import { type GroupLetter, groupLetters, teamById } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

const STAT_NAMES = new Set(
  "rank points gamesPlayed wins ties losses pointsFor pointsAgainst pointDifferential".split(
    " ",
  ),
);

const stat = (entry: StandingEntry, name: string) =>
  entry.stats?.find((s) => s.name === name);

function compactEntry(entry: StandingEntry) {
  return {
    team: entry.team.displayName,
    qualified: (stat(entry, "advanced")?.value ?? 0) > 0,
    stats: Object.fromEntries(
      (entry.stats ?? []).flatMap(({ name, displayValue }) =>
        name && STAT_NAMES.has(name) ? [[name, displayValue]] : [],
      ),
    ),
  };
}

// The third-place race, from real results: the twelve thirds ranked by their
// chance of taking one of the eight Round-of-32 slots, plus which R32 match each
// likely third heads to and how settled the picture is.
async function thirdsRace() {
  const results = await getMatchResults();
  const teamByGroup = new Map<string, string>(
    results.bestThirds.map((t) => [t.group, t.teamId]),
  );

  const chanceByGroup = new Map<string, number>();
  for (const odds of Object.values(results.thirdOdds))
    for (const [group, prob] of Object.entries(odds))
      chanceByGroup.set(group, (chanceByGroup.get(group) ?? 0) + (prob ?? 0));

  const ranking = results.bestThirds
    .map((t) => ({
      team: teamName(t.teamId),
      group: t.group,
      points: t.points,
      goalDifference: t.goalDiff,
      qualifyingChancePercent: percent(chanceByGroup.get(t.group) ?? 0),
      qualifies: t.qualifies,
    }))
    .sort((a, b) => b.qualifyingChancePercent - a.qualifyingChancePercent);

  const roundOf32 = [...thirdPlaceSlots]
    .sort((a, b) => a.match - b.match)
    .map((slot) => {
      const candidates = Object.entries(results.thirdOdds[slot.match] ?? {})
        .map(([group, p]) => ({
          group,
          team: teamName(teamByGroup.get(group) ?? group),
          chancePercent: percent(p ?? 0),
        }))
        .filter((c) => c.chancePercent > 0)
        .sort((a, b) => b.chancePercent - a.chancePercent);
      return {
        match: slot.match,
        host: `winner of Group ${slot.winner}`,
        mostLikelyThird: candidates[0] ?? null,
        otherPossibleThirds: candidates.slice(1),
      };
    });

  return {
    kind: "thirds" as const,
    asOf: results.updatedAt,
    scenariosStillPossible: results.thirdCombosPossible,
    outOf: 495,
    note: "Provisional until every group finishes — the best eight thirds (qualifies = true) take the eight third-place slots.",
    ranking,
    roundOf32,
  };
}

export default defineTool({
  description:
    "World Cup group tables and the third-place race. Pass a group letter for one group's standings (rank, points, goal difference, who's already through), or thirds:true for the twelve third-placed teams ranked by their chance of reaching the Round of 32. To put a table on screen, also write a `group` or `thirds` code block.",
  inputSchema: z.object({
    group: groupLetter.optional().describe("A group letter, A-L."),
    thirds: z
      .boolean()
      .optional()
      .describe("Set true for the third-place qualification race."),
  }),
  async execute({ group, thirds }) {
    if (thirds) return thirdsRace();

    const standings = await fetchStandings();
    const groups = (standings.children ?? [])
      .filter((item) => !group || item.name === `Group ${group}`)
      .map((item) => ({
        group: item.name,
        teams: (item.standings?.entries ?? []).map(compactEntry),
      }));
    const qualified = groups.flatMap(({ group, teams }) =>
      teams
        .filter((team) => team.qualified)
        .map(({ team }) => ({ group, team })),
    );

    return { kind: "groups" as const, groups, qualified };
  },
});
