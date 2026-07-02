"use client";

import { ScoreMatrixCard } from "@/components/widgets/score-matrix-card";
import { usePredictions } from "@/components/widgets/queries";
import type { KnockoutOdds, Predictions } from "@/lib/predictions";
import type { Round } from "@/lib/tournament";
import { matchByNumber, teamById } from "@/lib/tournament";

const PHASE_LABEL: Record<Round, string> = {
  R32: "R32",
  R16: "R16",
  QF: "Quarter",
  SF: "Semifinal",
  TP: "3rd place",
  FINAL: "Final",
};

// The decided knockout matchup the block names: a match number, or a team pair
// in either bracket orientation. Only matches with a live per-game market are
// in `knockoutOdds`, so an undecided or unpriced matchup resolves to nothing.
function resolveMatch(
  predictions: Predictions,
  match?: number,
  teams?: string[],
): KnockoutOdds | undefined {
  if (match) return predictions.knockoutOdds.find((o) => o.match === match);
  if (teams && teams.length >= 2) {
    const pair = new Set(teams.slice(0, 2));
    return predictions.knockoutOdds.find(
      (o) => pair.has(o.home) && pair.has(o.away),
    );
  }
  return undefined;
}

interface ScoreMatrixWidgetProps {
  /** FIFA match number (73–104). */
  match?: number;
  /** Alternatively, the two teams (FIFA codes) of a decided knockout match. */
  teams?: string[];
}

/** The exact-score chance matrix for one decided knockout match, straight from
 *  the market's exact-score prices. */
export function ScoreMatrixWidget({ match, teams }: ScoreMatrixWidgetProps) {
  const predictions = usePredictions();
  if (!predictions) return <ScoreMatrixCard loading />;

  const odds = resolveMatch(predictions, match, teams);
  const cells = odds ? predictions.knockoutScoreChances[odds.match] : undefined;
  if (!odds || !cells?.length) return <ScoreMatrixCard empty />;

  const round = matchByNumber[odds.match]?.round;
  return (
    <ScoreMatrixCard
      number={odds.match}
      phaseLabel={round ? PHASE_LABEL[round] : ""}
      home={{ code: odds.home, name: teamById[odds.home]?.name }}
      away={{ code: odds.away, name: teamById[odds.away]?.name }}
      cells={cells}
    />
  );
}
