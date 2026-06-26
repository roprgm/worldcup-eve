"use client";

import { useCallback } from "react";

import {
  BracketCard,
  type BracketSlot,
} from "@/components/widgets/bracket-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

// Index the predicted slots by "match:side" so the bracket can look up any node
// in O(1); recomputed only when the predictions change.
function bracketView(predictions: Predictions) {
  const slots = new Map<string, BracketSlot>();
  for (const slot of predictions.slots) {
    const top = slot.candidates[0];
    if (!top) continue;
    slots.set(`${slot.match}:${slot.side}`, {
      code: top.code,
      name: teamById[top.code]?.name,
      probability: top.probability,
    });
  }
  return { slots, championCode: predictions.bracketChampion[0]?.code };
}

/** The full knockout bracket with each slot's predicted team. Structure renders
 *  immediately; the picks and probabilities fill in with the market. */
export function BracketWidget() {
  const view = usePredictions(bracketView);
  const getSlot = useCallback(
    (match: number, side: "home" | "away") =>
      view?.slots.get(`${match}:${side}`),
    [view],
  );

  return <BracketCard getSlot={getSlot} championCode={view?.championCode} />;
}
