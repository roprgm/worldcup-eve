"use client";

import type { BracketSlot } from "@/components/widgets/bracket-card";
import {
  CircularBracketCard,
  type CircularBracketView,
} from "@/components/widgets/circular-bracket-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { knockoutMatches, matchByNumber, teamById } from "@/lib/tournament";

function slotOf(code: string, probability: number): BracketSlot {
  return { code, name: teamById[code]?.name, probability };
}

// Derive the circular view: the predicted team per slot, the advancing team per
// match (read off the parent slot it feeds), and the champion (BT final winner).
function circularView(predictions: Predictions): CircularBracketView {
  const slots = new Map<string, BracketSlot>();
  for (const slot of predictions.slots) {
    const top = slot.candidates[0];
    if (top)
      slots.set(
        `${slot.match}:${slot.side}`,
        slotOf(top.code, top.probability),
      );
  }

  // A match's winner is whoever fills the slot it feeds in the next round; the
  // slot's probability there is that team's chance of reaching it — i.e. of
  // winning this match.
  const winner = new Map<number, BracketSlot>();
  for (const m of knockoutMatches) {
    if (m.feedsInto == null) continue;
    const parent = matchByNumber[m.feedsInto];
    const side =
      parent.home.kind === "match" && parent.home.match === m.number
        ? "home"
        : "away";
    const fed = slots.get(`${m.feedsInto}:${side}`);
    if (fed) winner.set(m.number, fed);
  }

  // Each team's chance to win each match (the BT head-to-head split), keyed
  // "match:code" — the per-flag number the card shows on the outer ring.
  const win = new Map<string, number>();
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds))
    for (const c of candidates) win.set(`${match}:${c.code}`, c.probability);

  const top = predictions.bracketChampion[0];
  const champion = top ? slotOf(top.code, top.probability) : undefined;
  if (champion) winner.set(104, champion);

  return { slots, winner, win, champion };
}

/** Connected circular bracket: fetches the shared predictions and paints the
 *  picks onto the radial skeleton. */
export function CircularBracketWidget() {
  const view = usePredictions(circularView);
  return <CircularBracketCard view={view} />;
}
