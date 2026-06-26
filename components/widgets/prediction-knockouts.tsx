"use client";

import { addMinutes, format } from "date-fns";

import { CardGrid } from "@/components/widgets/card-grid";
import { PredictionMatchGrid } from "@/components/widgets/prediction-sections";
import { usePredictions } from "@/components/widgets/queries";
import { MatchCardSkeleton } from "@/components/widgets/widget-skeletons";
import type { Predictions } from "@/lib/predictions";
import type { KnockoutMatch, Round, SlotRef } from "@/lib/tournament";
import { teamById } from "@/lib/tournament";

type Candidate = { code: string; probability: number };
type Lookup = Map<string, Candidate[]>;

const PHASE_LABEL: Record<Round, string> = {
  R32: "R32",
  R16: "R16",
  QF: "Quarter",
  SF: "Semifinal",
  TP: "3rd place",
  FINAL: "Final",
};

function candidateView(candidate: Candidate) {
  return { ...candidate, name: teamById[candidate.code]?.name };
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

function matchView(match: KnockoutMatch, lookup: Lookup) {
  return {
    number: match.number,
    phaseLabel: PHASE_LABEL[match.round],
    dateTime: kickoffLabel(match.kickoffAt),
    location: match.venue,
    title: match.venue,
    home: sideFor(match, "home", lookup),
    away: sideFor(match, "away", lookup),
  };
}

// Index every slot's candidates by `match:side` so a match can look up both of
// its sides. Used as react-query `select`, so it recomputes only on new data.
function buildLookup(predictions: Predictions): Lookup {
  const lookup: Lookup = new Map();
  for (const slot of predictions.slots) {
    lookup.set(`${slot.match}:${slot.side}`, slot.candidates);
  }
  return lookup;
}

/** Connected knockout round: takes the round's fixtures, fetches the shared
 *  predictions for each side's candidates, and renders the match grid. */
export function PredictionKnockoutRound({
  matches,
}: {
  matches: KnockoutMatch[];
}) {
  const lookup = usePredictions(buildLookup);

  if (!lookup) {
    return (
      <div className="animate-pulse" aria-hidden>
        <CardGrid>
          {matches.map((match) => (
            <MatchCardSkeleton key={match.number} />
          ))}
        </CardGrid>
      </div>
    );
  }

  return (
    <PredictionMatchGrid matches={matches.map((m) => matchView(m, lookup))} />
  );
}
