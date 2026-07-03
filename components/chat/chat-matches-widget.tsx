"use client";

import type { ReactNode } from "react";

import {
  liveMatchViews,
  matchViewsByNumber,
  todayMatchViews,
} from "@/components/widgets/match-view";
import { MatchWidget } from "@/components/widgets/match-widget";
import { usePredictions, useResults } from "@/components/widgets/queries";
import { Skeleton } from "@/components/ui/skeleton";

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

  // The widget renders as soon as the show_match call's args land, before the
  // feed does — so show a skeleton until the results arrive rather than a bare
  // gap next to the sentence.
  if (!results) return <MatchesGrid>{loadingCards(numbers)}</MatchesGrid>;

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
    <MatchesGrid>
      {views.map((view) => (
        <MatchWidget key={view.number} {...view} />
      ))}
    </MatchesGrid>
  );
}

function MatchesGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function loadingCards(numbers?: number[]) {
  const count = numbers?.length || 2;
  return Array.from({ length: count }, (_, i) => (
    <Skeleton key={i} className="h-[132px] w-full" />
  ));
}
