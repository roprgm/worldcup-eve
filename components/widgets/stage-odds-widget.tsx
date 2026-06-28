"use client";

import {
  StageOddsCard,
  type StageOddsRow,
} from "@/components/widgets/stage-odds-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

// Join each team's per-round reach (BT model) with its group-stage advance
// chance (the R32 column), drop the eliminated, and order by title odds — the
// same read as the champion market, laid out as a full road-to-the-final table.
function stageRows(predictions: Predictions): StageOddsRow[] {
  const advanceByCode = new Map<string, number>();
  for (const group of predictions.groups)
    for (const team of group.teams) advanceByCode.set(team.code, team.advance);

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
    }))
    .filter((row) => row.r32 > 0 || row.r16 > 0)
    .sort((a, b) => b.champion - a.champion || b.final - a.final);
}

/** Every contender ranked by title odds, with its chance to reach each round. */
export function StageOddsWidget() {
  const rows = usePredictions(stageRows);
  return rows ? <StageOddsCard rows={rows} /> : <StageOddsCard loading />;
}
