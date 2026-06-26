"use client";

import { useResults } from "@/components/widgets/queries";
import {
  type ThirdOddsCandidate,
  ThirdOddsCard,
  type ThirdRankingRow,
  ThirdsRankingCard,
  type ThirdSlotChance,
} from "@/components/widgets/thirds-card";
import type { Results } from "@/lib/results";
import { type GroupLetter, matchByNumber, teamById } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const WINNER_BY_MATCH = new Map(
  thirdPlaceSlots.map((s) => [s.match, s.winner]),
);

// The five groups whose third can structurally fill a slot (FIFA's allowed set),
// kept as candidates even once a group is mathematically out (shown at 0%).
function slotGroups(match: number): GroupLetter[] {
  const m = matchByNumber[match];
  const ref = m.home.kind === "third" ? m.home : m.away;
  return ref.kind === "third" ? ref.groups : [];
}

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

function rankingRows(results: Results): ThirdRankingRow[] {
  const slots = slotChancesByGroup(results);
  return results.bestThirds.map((t) => {
    const segments = slots.get(t.group) ?? [];
    return {
      group: t.group,
      code: t.teamId,
      name: teamById[t.teamId]?.name,
      rank: t.rank,
      points: t.points,
      goalDiff: signed(t.goalDiff),
      goalsFor: t.goalsFor,
      segments,
      chance: segments.reduce((sum, s) => sum + s.prob, 0),
      qualifies: t.qualifies,
    };
  });
}

// Map a slot's per-group odds onto each group's current third-placed team.
function oddsCandidates(match: number, results: Results): ThirdOddsCandidate[] {
  const teamByGroup = new Map<string, string>(
    results.bestThirds.map((t) => [t.group, t.teamId]),
  );
  const odds = results.thirdOdds[match] ?? {};
  return slotGroups(match)
    .map((group) => {
      const code = teamByGroup.get(group) ?? group;
      return {
        code,
        name: teamById[code]?.name,
        probability: odds[group] ?? 0,
      };
    })
    .sort((a, b) => b.probability - a.probability);
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

/** One Round-of-32 third slot with each candidate team's chance, uniform over
 *  the combinations still reachable from the current results. */
export function ThirdOddsWidget({ match }: { match: number }) {
  const candidates = useResults((results) => oddsCandidates(match, results));
  const host = WINNER_BY_MATCH.get(match) ?? "?";
  return candidates ? (
    <ThirdOddsCard host={host} match={match} candidates={candidates} />
  ) : (
    <ThirdOddsCard host={host} match={match} loading />
  );
}

/** A one-line note on how many of the 495 combinations remain mathematically
 *  possible — the population the odds are uniform over. */
export function ThirdScenariosCaption() {
  const possible = useResults((r) => r.thirdCombosPossible);
  if (!possible) return null;
  return (
    <p className="px-1 pb-1 text-[11px] text-muted-foreground">
      Equal odds across the {possible} of 495 combinations still mathematically
      possible.
    </p>
  );
}
