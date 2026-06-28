"use client";

import {
  type Candidate,
  CircularBracketCard,
  type CircularBracketView,
} from "@/components/widgets/circular-bracket-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const named = (c: { code: string; probability: number }): Candidate => ({
  code: c.code,
  name: teamById[c.code]?.name,
  probability: c.probability,
});

// Derive the circular view from the shared predictions: the candidates per R32
// slot (who fills each outer spot), the win odds per match (who advances), and
// the title odds. The card decides flag-vs-chevron from how settled each is.
function circularView(predictions: Predictions): CircularBracketView {
  const slotOdds = new Map<string, Candidate[]>();
  for (const slot of predictions.slots)
    slotOdds.set(`${slot.match}:${slot.side}`, slot.candidates.map(named));

  const matchOdds = new Map<number, Candidate[]>();
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds))
    matchOdds.set(Number(match), candidates.map(named));

  return {
    slotOdds,
    matchOdds,
    championOdds: predictions.bracketChampion.map(named),
  };
}

/** Connected circular bracket: fetches the shared predictions and paints them
 *  onto the radial skeleton. */
export function CircularBracketWidget() {
  const view = usePredictions(circularView);
  return <CircularBracketCard view={view} />;
}
