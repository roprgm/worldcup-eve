"use client";

import { addMinutes, format } from "date-fns";
import { useMemo } from "react";

import { PredictionMatchCard } from "@/components/widgets/prediction-match-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import type { KnockoutMatch, Round, SlotRef } from "@/lib/tournament";
import { teamById } from "@/lib/tournament";

type Candidate = { code: string; probability: number };

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

// The label, date and venue are static (from the bracket); only the candidates
// need the market. While it loads, candidates stay `undefined` and the card
// skeletons just that part.
function sideFor(
  match: KnockoutMatch,
  side: "home" | "away",
  predictions: Predictions | undefined,
) {
  const ref = match[side];
  const candidates = predictions
    ? (
        predictions.slots.find(
          (s) => s.match === match.number && s.side === side,
        )?.candidates ?? []
      ).map(candidateView)
    : undefined;
  return {
    label: slotLabel(ref),
    candidates,
    showAll: showAllCandidates(ref, match.round),
  };
}

function matchView(match: KnockoutMatch, predictions: Predictions | undefined) {
  return {
    number: match.number,
    phaseLabel: PHASE_LABEL[match.round],
    dateTime: kickoffLabel(match.kickoffAt),
    location: match.venue,
    title: match.venue,
    home: sideFor(match, "home", predictions),
    away: sideFor(match, "away", predictions),
  };
}

/** A single knockout fixture with each side's predicted qualifiers. The header
 *  and slot labels render immediately; the candidates fill in with the market. */
export function PredictionMatchWidget({ match }: { match: KnockoutMatch }) {
  const predictions = usePredictions();
  const view = useMemo(
    () => matchView(match, predictions),
    [match, predictions],
  );

  return <PredictionMatchCard {...view} />;
}
