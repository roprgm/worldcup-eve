"use client";

import { useResults } from "@/components/widgets/queries";
import {
  ThirdsRankingCard,
  ThirdsSlotsCard,
  type ThirdRankingRow,
  type ThirdSlotRow,
} from "@/components/widgets/thirds-card";
import { teamById } from "@/lib/tournament";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";
import type { Results } from "@/lib/results";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const winnerByMatch = new Map(thirdPlaceSlots.map((s) => [s.match, s.winner]));

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

function slotRows(results: Results): ThirdSlotRow[] {
  return [...results.thirdSlots]
    .sort((a, b) => a.match - b.match)
    .map((s) => ({
      match: s.match,
      winner: winnerByMatch.get(s.match) ?? "?",
      code: s.teamId,
      name: teamById[s.teamId]?.name,
    }));
}

/** The twelve third-placed teams ranked as things stand. */
export function ThirdsRankingWidget() {
  const rows = useResults(rankingRows);
  return rows ? <ThirdsRankingCard rows={rows} /> : <ThirdsRankingCard loading />;
}

/** The eight Round-of-32 third-place matchups those qualifiers imply. */
export function ThirdsSlotsWidget() {
  const rows = useResults(slotRows);
  return rows ? <ThirdsSlotsCard rows={rows} /> : <ThirdsSlotsCard loading />;
}
