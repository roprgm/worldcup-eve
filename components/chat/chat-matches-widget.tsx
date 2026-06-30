"use client";

import { matchViewsByNumber } from "@/components/widgets/match-view";
import { MatchWidget } from "@/components/widgets/match-widget";
import { usePredictions, useResults } from "@/components/widgets/queries";

/** Live cards for a set of matches by FIFA number. Self-fetches results and
 *  odds so scores and clocks stay current, then renders one MatchWidget each. */
export function ChatMatches({ numbers }: { numbers: number[] }) {
  const results = useResults();
  const predictions = usePredictions();
  if (!results) return null;

  const views = matchViewsByNumber(
    results.matches,
    predictions?.matchOdds ?? [],
    numbers,
  );
  if (views.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {views.map((view) => (
        <MatchWidget key={view.number} {...view} />
      ))}
    </div>
  );
}
