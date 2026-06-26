"use client";

import { useResults } from "@/components/widgets/queries";
import {
  type ThirdOddsCandidate,
  ThirdOddsCard,
  type ThirdRankingRow,
  ThirdsRankingCard,
} from "@/components/widgets/thirds-card";
import type { Results } from "@/lib/results";
import { teamById } from "@/lib/tournament";
import {
  thirdPlaceSlots,
  uniformThirdSlotOdds,
} from "@/lib/tournament/third-place";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

// Static baseline odds (uniform over all 495 combinations) and slot hosts.
const ODDS = uniformThirdSlotOdds();
const WINNER_BY_MATCH = new Map(
  thirdPlaceSlots.map((s) => [s.match, s.winner]),
);

function rankingRows(results: Results): ThirdRankingRow[] {
  return results.bestThirds.map((t) => ({
    group: t.group,
    code: t.teamId,
    name: teamById[t.teamId]?.name,
    rank: t.rank,
    points: t.points,
    goalDiff: signed(t.goalDiff),
    goalsFor: t.goalsFor,
    qualifies: t.qualifies,
  }));
}

// Map each slot's per-group odds onto the group's current third-placed team.
function oddsCandidates(match: number, results: Results): ThirdOddsCandidate[] {
  const teamByGroup = new Map<string, string>(
    results.bestThirds.map((t) => [t.group, t.teamId]),
  );
  return Object.entries(ODDS[match] ?? {})
    .map(([group, probability]) => {
      const code = teamByGroup.get(group) ?? group;
      return { code, name: teamById[code]?.name, probability };
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

/** One Round-of-32 third slot with each candidate team's chance (uniform prior). */
export function ThirdOddsWidget({ match }: { match: number }) {
  const candidates = useResults((results) => oddsCandidates(match, results));
  const host = WINNER_BY_MATCH.get(match) ?? "?";
  return candidates ? (
    <ThirdOddsCard host={host} match={match} candidates={candidates} />
  ) : (
    <ThirdOddsCard host={host} match={match} loading />
  );
}
