"use client";

import type {
  BracketSlot,
  SlotLookup,
} from "@/components/widgets/bracket-card";
import {
  CircularBracketCard,
  type CircularBracketView,
} from "@/components/widgets/circular-bracket-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { knockoutMatches, teamById } from "@/lib/tournament";

// Derive the circular view from the shared predictions: a slot lookup whose
// probability is the team's chance to win that match (so every ring shows a
// live number), the predicted winner per match, and the champion.
function circularView(predictions: Predictions): CircularBracketView {
  // The predicted occupant of each slot (its most likely team).
  const occupant = new Map<string, string>();
  for (const slot of predictions.slots) {
    const top = slot.candidates[0];
    if (top) occupant.set(`${slot.match}:${slot.side}`, top.code);
  }

  // Each team's chance to win each match (the BT head-to-head split).
  const win = new Map<string, number>();
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds))
    for (const c of candidates) win.set(`${match}:${c.code}`, c.probability);

  const getSlot: SlotLookup = (match, side) => {
    const code = occupant.get(`${match}:${side}`);
    if (!code) return undefined;
    return {
      code,
      name: teamById[code]?.name,
      probability: win.get(`${match}:${code}`),
    };
  };

  // A match's winner is the side the model has more likely to win it.
  const winner = new Map<number, BracketSlot>();
  for (const m of knockoutMatches) {
    const home = getSlot(m.number, "home");
    const away = getSlot(m.number, "away");
    const lead =
      (home?.probability ?? 0) >= (away?.probability ?? 0) ? home : away;
    if (lead) winner.set(m.number, lead);
  }

  const top = predictions.bracketChampion[0];
  const champion = top
    ? {
        code: top.code,
        name: teamById[top.code]?.name,
        probability: top.probability,
      }
    : undefined;

  return { getSlot, winner, champion };
}

/** Connected circular bracket: fetches the shared predictions and paints the
 *  picks onto the radial skeleton of match subcards. */
export function CircularBracketWidget() {
  const view = usePredictions(circularView);
  return <CircularBracketCard view={view} />;
}
