"use client";

import { CardGrid } from "@/components/ui/card-grid";
import { todayMatchViews } from "@/components/widgets/match-view";
import { MatchWidget } from "@/components/widgets/match-widget";
import { usePredictions, useResults } from "@/components/widgets/queries";

function Message({ children }: { children: string }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

// Owns its layout: derives the list of matches to show and lays them in a grid.
export default function TodayPage() {
  const results = useResults();
  const predictions = usePredictions();
  const matches = results
    ? todayMatchViews(results.matches, predictions?.matchOdds ?? [])
    : null;

  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4">
        {matches === null ? (
          <Message>Loading today’s matches…</Message>
        ) : matches.length === 0 ? (
          <Message>No matches today.</Message>
        ) : (
          <CardGrid>
            {matches.map((match) => (
              <MatchWidget key={match.number} {...match} />
            ))}
          </CardGrid>
        )}
      </div>
    </main>
  );
}
