"use client";

import { PredictionChampionCard } from "@/components/widgets/prediction-champion-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

// react-query `select`, so it recomputes only when the predictions change.
function championView(predictions: Predictions) {
  return predictions.champion.map((c) => ({
    ...c,
    name: teamById[c.code]?.name,
  }));
}

/** Connected champion card: fetches the shared predictions and renders the most
 *  likely champion. The header shows immediately; the pick fills in with the
 *  market (`candidates` is `undefined` until then). */
export function PredictionChampionWidget() {
  const candidates = usePredictions(championView);
  return <PredictionChampionCard candidates={candidates} />;
}
