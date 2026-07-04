import { percent, teamName } from "@/agent/lib/fixtures";
import { getMatchResults } from "@/lib/results";
import { fetchStandings, type StandingEntry } from "@/lib/results/standings";
import type { GroupLetter } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

// Shared standings builders. Both the `standings` data tool and the `show_group`
// / `show_thirds` widget tools read from here.

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

export async function groupTables(letters?: GroupLetter[]) {
  const wanted = new Set(letters?.map((letter) => `Group ${letter}`));
  const standings = await fetchStandings();
  const groups = (standings.children ?? [])
    .filter((item) => wanted.size === 0 || wanted.has(item.name ?? ""))
    .map((item) => ({
      group: item.name,
      teams: (item.standings?.entries ?? []).map(compactEntry),
    }));
  const qualified = groups.flatMap(({ group, teams }) =>
    teams.filter((team) => team.qualified).map(({ team }) => ({ group, team })),
  );

  return { kind: "groups" as const, groups, qualified };
}

// The third-place race, from real results: the twelve thirds ranked by their
// chance of taking one of the eight Round-of-32 slots, plus which R32 match each
// likely third heads to and how settled the picture is.
export async function thirdsRace() {
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

export function summarizeGroups(
  o: Awaited<ReturnType<typeof groupTables>>,
): string {
  if (o.groups.length === 0) return "No matching groups.";
  const line = (g: (typeof o.groups)[number]) =>
    `${g.group}: ${g.teams.map((t) => t.team).join(", ")}`;
  const through = o.qualified.length
    ? ` Through: ${o.qualified.map((q) => `${q.team} (${q.group})`).join(", ")}.`
    : "";
  return `${o.groups.map(line).join("; ")}.${through}`;
}

export function summarizeThirds(
  o: Awaited<ReturnType<typeof thirdsRace>>,
): string {
  const top = o.ranking
    .slice(0, 8)
    .map((t) => `${t.team} ${t.qualifyingChancePercent}%`)
    .join(", ");
  return `Third-place race (${o.scenariosStillPossible}/${o.outOf} scenarios still open). Likeliest to qualify: ${top}.`;
}
