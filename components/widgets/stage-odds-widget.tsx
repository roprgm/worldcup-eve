"use client";

import { useMemo } from "react";

import {
  StageOddsCard,
  type StageOddsRow,
} from "@/components/widgets/stage-odds-card";
import { usePredictions, useResults } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import type { Results } from "@/lib/results";
import { teamById } from "@/lib/tournament";

const isTeam = (code: string) => Boolean(teamById[code]);

// Stage index a team reaches by *winning* the given knockout match — R32 win →
// R16 (1), … , Final win → champion (5). Keyed by FIFA match number range.
function winStage(match: number): number | null {
  if (match >= 73 && match <= 88) return 1; // won R32 → reached R16
  if (match >= 89 && match <= 96) return 2; // won R16 → reached QF
  if (match >= 97 && match <= 100) return 3; // won QF → reached SF
  if (match === 101 || match === 102) return 4; // won SF → reached Final
  if (match === 104) return 5; // won Final → champion
  return null; // 103 is the third-place play-off
}

// Highest stage each team has *actually* reached, from real results (not the
// model): -1 if none. Group qualification is a fact once a group is fully played
// (top two, plus the assigned best thirds once every group is settled); each
// knockout win then advances the winner one stage.
function reachedIdxByTeam(results: Results): Map<string, number> {
  const reached = new Map<string, number>();
  const bump = (code: string, idx: number) => {
    if (!isTeam(code)) return;
    if (idx > (reached.get(code) ?? -1)) reached.set(code, idx);
  };

  for (const order of Object.values(results.settledGroupOrder)) {
    bump(order[0], 0);
    bump(order[1], 0);
  }
  // Best-third slots are only final once all twelve groups are; until then the
  // assignment is provisional, so leave those teams as predictions.
  if (Object.keys(results.settledGroupOrder).length === 12)
    for (const slot of results.thirdSlots) bump(slot.teamId, 0);

  for (const m of results.matches) {
    if (m.status !== "final" || m.n <= 72) continue;
    const idx = winStage(m.n);
    if (idx == null) continue;
    const winner = m.home.winner
      ? m.home.code
      : m.away.winner
        ? m.away.code
        : null;
    if (winner) bump(winner, idx);
  }
  return reached;
}

// Join each team's per-round reach (BT model) with its group-stage advance
// chance (the R32 column) and the rounds it has actually reached, drop the
// eliminated, and order by title odds — the champion-market read laid out as a
// full road-to-the-final table.
function stageRows(
  predictions: Predictions,
  results?: Results,
): StageOddsRow[] {
  const advanceByCode = new Map<string, number>();
  for (const group of predictions.groups)
    for (const team of group.teams) advanceByCode.set(team.code, team.advance);
  const reached = results
    ? reachedIdxByTeam(results)
    : new Map<string, number>();

  return predictions.reach
    .map((team) => ({
      code: team.code,
      name: teamById[team.code]?.name,
      r32: advanceByCode.get(team.code) ?? 0,
      r16: team.r16,
      qf: team.qf,
      sf: team.sf,
      final: team.final,
      champion: team.mktChampion,
      reachedIdx: reached.get(team.code) ?? -1,
    }))
    .filter((row) => row.r32 > 0 || row.r16 > 0 || row.reachedIdx >= 0)
    .sort((a, b) => b.champion - a.champion || b.final - a.final);
}

/** Every contender ranked by title odds, with its chance to reach each round and
 *  a check on the rounds it has already reached. */
export function StageOddsWidget() {
  const predictions = usePredictions();
  const results = useResults();
  const rows = useMemo(
    () => (predictions ? stageRows(predictions, results) : undefined),
    [predictions, results],
  );
  return rows ? <StageOddsCard rows={rows} /> : <StageOddsCard loading />;
}
