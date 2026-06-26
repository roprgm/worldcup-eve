"use client";

import { CardGrid } from "@/components/widgets/card-grid";
import { MatchWidget } from "@/components/widgets/match-widget";
import { todayMatchViews } from "@/components/widgets/match-view";
import { usePredictions, useResults } from "@/components/widgets/queries";

function Message({ children }: { children: string }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** Connected today widget: fetches the shared results (for scores/status) and
 *  predictions (for win odds), then renders today's matches as cards. */
export function TodayMatches() {
  const results = useResults();
  const predictions = usePredictions();

  if (!results) {
    return <Message>Loading today’s matches…</Message>;
  }

  const matches = todayMatchViews(
    results.matches,
    predictions?.matchOdds ?? [],
  );
  if (matches.length === 0) {
    return <Message>No matches today.</Message>;
  }

  return (
    <CardGrid>
      {matches.map((match) => (
        <MatchWidget key={match.number} {...match} />
      ))}
    </CardGrid>
  );
}
