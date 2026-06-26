"use client";

import { CardGrid } from "@/components/widgets/card-grid";
import { GroupStage } from "@/components/widgets/group-stage";
import { usePredictions, useResults } from "@/components/widgets/queries";
import { GroupCardSkeleton } from "@/components/widgets/widget-skeletons";

// 12 groups (A–L); the indexes just key the placeholders.
const GROUP_PLACEHOLDERS = Array.from({ length: 12 }, (_, i) => i);

/** Connected group stage: fetches the shared predictions/results, shows a
 *  skeleton grid until both land, then renders the read-only GroupStage. */
export function PredictionGroupStage() {
  const predictions = usePredictions();
  const results = useResults();

  if (!predictions || !results) {
    return (
      <div className="animate-pulse" aria-hidden>
        <CardGrid>
          {GROUP_PLACEHOLDERS.map((i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </CardGrid>
      </div>
    );
  }

  return (
    <GroupStage
      groups={predictions.groups}
      predicted={predictions.groupScores}
      live={results}
    />
  );
}
