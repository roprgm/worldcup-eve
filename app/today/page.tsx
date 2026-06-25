"use client";

import { CardGrid } from "@/app/predictions/components/card-grid";
import { MatchWidget } from "@/components/widgets/match-widget";
import { usePredictions, useResults } from "@/app/predictions/hooks";
import { todayMatchViews } from "@/app/today/today-matches";

function Message({ children }: { children: string }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

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
