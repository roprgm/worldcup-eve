"use client";

import { PredictionChampionCard } from "@/components/widgets/prediction-champion-card";
import { usePredictions } from "@/components/widgets/queries";
import { ChampionCardSkeleton } from "@/components/widgets/widget-skeletons";
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
 *  likely champion, with a skeleton while it loads. */
export function PredictionChampionWidget() {
  const candidates = usePredictions(championView);

  if (!candidates) {
    return (
      <div className="animate-pulse" aria-hidden>
        <ChampionCardSkeleton />
      </div>
    );
  }

  return <PredictionChampionCard candidates={candidates} />;
}
