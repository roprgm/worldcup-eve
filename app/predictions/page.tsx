"use client";

import { addMinutes, format } from "date-fns";
import { useMemo } from "react";

import {
  finalMatch,
  roundLabel,
  roundMatches,
  thirdPlaceMatch,
} from "@/app/predictions/bracket";
import { GroupStage } from "@/app/predictions/components/group-stage";
import { PredictionChampionCard } from "@/app/predictions/components/prediction-champion-card";
import {
  PredictionMatchGrid,
  PredictionSection,
} from "@/app/predictions/components/prediction-sections";
import { PredictionsSkeleton } from "@/app/predictions/components/predictions-skeleton";
import { usePredictions, useResults } from "@/app/predictions/hooks";
import type { Predictions } from "@/lib/predictions";
import type { Results } from "@/lib/results";
import type { KnockoutMatch, Round, SlotRef } from "@/lib/tournament";
import { teamById } from "@/lib/tournament";

type Candidate = { code: string; probability: number };
type Lookup = Map<string, Candidate[]>;

function candidateView(candidate: Candidate) {
  return {
    ...candidate,
    name: teamById[candidate.code]?.name,
  };
}

function slotLabel(ref: SlotRef): string {
  switch (ref.kind) {
    case "winner":
      return `First ${ref.group}`;
    case "runner":
      return `Second ${ref.group}`;
    case "third":
      return `3rd ${ref.groups.join("/")}`;
    case "match":
      return `Winner #${ref.match}`;
    case "loser":
      return `Loser #${ref.match}`;
  }
}

function showAllCandidates(ref: SlotRef, round: Round): boolean {
  return round === "R32" && (ref.kind === "winner" || ref.kind === "runner");
}

// "2026-07-04T21:00:00Z" → "Jul 4 · 21h" (UTC). date-fns formats in local time,
// so shift by the offset to render the UTC wall clock deterministically.
function kickoffLabel(kickoffAt: string): string {
  const date = new Date(kickoffAt);
  const utc = addMinutes(date, date.getTimezoneOffset());
  return format(
    utc,
    utc.getMinutes() === 0 ? "MMM d · H'h'" : "MMM d · H:mm'h'",
  );
}

function sideFor(match: KnockoutMatch, side: "home" | "away", lookup: Lookup) {
  const ref = match[side];
  return {
    label: slotLabel(ref),
    candidates: (lookup.get(`${match.number}:${side}`) ?? []).map(
      candidateView,
    ),
    showAll: showAllCandidates(ref, match.round),
  };
}

function matchView(match: KnockoutMatch, lookup: Lookup, phaseLabel: string) {
  return {
    number: match.number,
    phaseLabel,
    dateTime: kickoffLabel(match.kickoffAt),
    location: match.venue,
    title: match.venue,
    home: sideFor(match, "home", lookup),
    away: sideFor(match, "away", lookup),
  };
}

const FUNNEL: Round[] = ["R32", "R16", "QF", "SF"];
const PHASE_LABEL: Record<Round, string> = {
  R32: "R32",
  R16: "R16",
  QF: "Quarter",
  SF: "Semifinal",
  TP: "3rd place",
  FINAL: "Final",
};

function PredictionsContent({
  predictions,
  results,
}: {
  predictions: Predictions;
  results: Results | null;
}) {
  const lookup = useMemo(() => {
    const next: Lookup = new Map();
    for (const slot of predictions.slots) {
      next.set(`${slot.match}:${slot.side}`, slot.candidates);
    }
    return next;
  }, [predictions]);
  const knockoutSections = [
    ...FUNNEL.map((round) => ({
      id: round,
      title: roundLabel[round],
      matches: roundMatches(round).map((match) =>
        matchView(match, lookup, PHASE_LABEL[round]),
      ),
    })),
    {
      id: "FINALS",
      title: "Finals",
      matches: [
        matchView(thirdPlaceMatch, lookup, PHASE_LABEL.TP),
        matchView(finalMatch, lookup, PHASE_LABEL.FINAL),
      ],
    },
  ];

  return (
    <div className="space-y-3">
      <PredictionSection title="Groups">
        <GroupStage
          groups={predictions.groups}
          predicted={predictions.groupScores}
          live={results ?? undefined}
        />
      </PredictionSection>

      {knockoutSections.map((section) => (
        <PredictionSection key={section.id} title={section.title}>
          <PredictionMatchGrid matches={section.matches} />
        </PredictionSection>
      ))}

      <PredictionSection title="Champion">
        <PredictionChampionCard
          candidates={predictions.champion.map(candidateView)}
        />
      </PredictionSection>
    </div>
  );
}

export default function PredictionsPage() {
  const predictions = usePredictions();
  const results = useResults();

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4">
        {!predictions ? (
          <PredictionsSkeleton />
        ) : (
          <PredictionsContent predictions={predictions} results={results} />
        )}
      </div>
    </main>
  );
}
