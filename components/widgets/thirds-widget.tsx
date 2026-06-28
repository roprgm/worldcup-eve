"use client";

import { useResults } from "@/components/widgets/queries";
import {
  type ThirdRankingRow,
  ThirdsRankingCard,
  type ThirdSlotChance,
} from "@/components/widgets/thirds-card";
import type { Results } from "@/lib/results";
import { type GroupLetter, teamById } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const WINNER_BY_MATCH = new Map(
  thirdPlaceSlots.map((s) => [s.match, s.winner]),
);

// Each group's third fills at most one Round-of-32 slot, so its per-slot odds are
// disjoint outcomes: list them per group (biggest first) and their sum is the
// chance of finishing among the best eight.
function slotChancesByGroup(
  results: Results,
): Map<GroupLetter, ThirdSlotChance[]> {
  const byGroup = new Map<GroupLetter, ThirdSlotChance[]>();
  for (const [match, odds] of Object.entries(results.thirdOdds)) {
    const host = WINNER_BY_MATCH.get(Number(match)) ?? "?";
    for (const [group, prob] of Object.entries(odds)) {
      if (!prob) continue;
      const g = group as GroupLetter;
      const list = byGroup.get(g) ?? [];
      list.push({ match: Number(match), host, prob });
      byGroup.set(g, list);
    }
  }
  for (const list of byGroup.values()) list.sort((a, b) => b.prob - a.prob);
  return byGroup;
}

// Ordered by qualification chance (biggest first) so the bars read top-down,
// with the current third-place table rank as a stable tiebreak.
function rankingRows(results: Results): ThirdRankingRow[] {
  const slots = slotChancesByGroup(results);
  const chanceOf = (group: GroupLetter) =>
    (slots.get(group) ?? []).reduce((sum, s) => sum + s.prob, 0);
  return [...results.bestThirds]
    .sort((a, b) => chanceOf(b.group) - chanceOf(a.group) || a.rank - b.rank)
    .map((t) => ({
      group: t.group,
      code: t.teamId,
      name: teamById[t.teamId]?.name,
      points: t.points,
      goalDiff: signed(t.goalDiff),
      goalsFor: t.goalsFor,
      segments: slots.get(t.group) ?? [],
      chance: chanceOf(t.group),
    }));
}

/** The twelve third-placed teams ranked as things stand. */
export function ThirdsRankingWidget() {
  const rows = useResults(rankingRows);
  return rows ? (
    <ThirdsRankingCard rows={rows} />
  ) : (
    <ThirdsRankingCard loading />
  );
}
