"use client";

import {
  liveMatchViews,
  matchViewsByNumber,
  todayMatchViews,
} from "@/components/widgets/match-view";
import { MatchWidget } from "@/components/widgets/match-widget";
import { usePredictions, useResults } from "@/components/widgets/queries";

export type MatchesScope = "today" | "live";

/** Live cards for a set of matches — by explicit number, or all of today's /
 *  in-progress matches. Self-fetches results and odds so scores and clocks stay
 *  current, then renders one MatchWidget each. */
export function ChatMatches({
  scope,
  numbers,
}: {
  scope?: MatchesScope;
  numbers?: number[];
}) {
  const results = useResults();
  const predictions = usePredictions();
  if (!results) return null;

  const odds = predictions?.matchOdds ?? [];
  const views = numbers?.length
    ? matchViewsByNumber(results.matches, odds, numbers)
    : scope === "live"
      ? liveMatchViews(results.matches, odds)
      : scope === "today"
        ? todayMatchViews(results.matches, odds)
        : [];

  if (views.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {views.map((view) => (
        <MatchWidget key={view.number} {...view} />
      ))}
    </div>
  );
}
