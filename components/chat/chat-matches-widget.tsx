"use client";

import {
  liveMatchViews,
  matchViewsByNumber,
  todayMatchViews,
} from "@/components/widgets/match-view";
import { MatchWidget } from "@/components/widgets/match-widget";
import { usePredictions, useResults } from "@/components/widgets/queries";

export type MatchesScope = "today" | "live";

// Past this a slate would bury the reply, so we render nothing and let the
// model answer in text — matches the cap in show_matches.
const MAX_CARDS = 6;

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

  if (views.length === 0 || views.length > MAX_CARDS) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {views.map((view) => (
        <MatchWidget key={view.number} {...view} />
      ))}
    </div>
  );
}
