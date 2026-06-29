"use client";

import { useMemo } from "react";

import {
  type Candidate,
  CircularBracketCard,
  type CircularBracketView,
} from "@/components/widgets/circular-bracket-card";
import { usePredictions, useResults } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import type { Results } from "@/lib/results";
import { matchByNumber, teamById } from "@/lib/tournament";

const named = (c: { code: string; probability: number }): Candidate => ({
  code: c.code,
  name: teamById[c.code]?.name,
  probability: c.probability,
});

// Played knockout matches, by match number → the actual winner (probability 1).
// These come from real results and override the market's odds, so a finished
// match shows its winner's flag instead of a still-open "?".
function decidedWinners(results?: Results): Map<number, Candidate> {
  const decided = new Map<number, Candidate>();
  if (!results) return decided;
  const byNumber = new Map(results.matches.map((m) => [m.n, m]));
  for (const [num, side] of Object.entries(results.knockoutPicks)) {
    const match = byNumber.get(Number(num));
    const team = side === "home" ? match?.home : match?.away;
    if (team?.code)
      decided.set(Number(num), {
        code: team.code,
        name: teamById[team.code]?.name,
        probability: 1,
      });
  }
  return decided;
}

// --- TEMP UI SIMULATION (revert before commit) ---------------------------
// Force `code` to win its R32 slot and the R16 match that slot feeds into, so
// the winner's solid line is seen advancing two levels.
function simulateWinnerPath(
  code: string,
  decided: Map<number, Candidate>,
  slotOdds: Map<string, Candidate[]>,
) {
  const win: Candidate = { code, name: teamById[code]?.name, probability: 1 };
  // Find the R32 slot this team leads.
  for (const [key, candidates] of slotOdds) {
    if (candidates[0]?.code !== code) continue;
    const r32 = Number(key.split(":")[0]);
    decided.set(r32, win); // wins R32
    const r16 = matchByNumber[r32]?.feedsInto;
    if (r16) decided.set(r16, win); // wins R16
    break;
  }
}
// -------------------------------------------------------------------------

// Derive the circular view: per R32 slot the teams that could fill it, per match
// each contender's chance to win it (i.e. advance), the real winner of any
// finished match, and the title odds.
function circularView(
  predictions: Predictions,
  results?: Results,
): CircularBracketView {
  const decided = decidedWinners(results);

  const slotOdds = new Map<string, Candidate[]>();
  for (const slot of predictions.slots)
    slotOdds.set(`${slot.match}:${slot.side}`, slot.candidates.map(named));

  // --- TEMP UI SIMULATION (revert before commit) -------------------------
  // Pretend FRA wins its R32 and the R16 it feeds into, so we can preview the
  // winner's line advancing two levels (R32 → R16 → QF).
  simulateWinnerPath("FRA", decided, slotOdds);
  // -----------------------------------------------------------------------

  // Each contender's chance to win the match — a finished match is pinned to
  // its real winner.
  const matchOdds = new Map<number, Candidate[]>();
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds)) {
    const num = Number(match);
    const win = decided.get(num);
    matchOdds.set(num, win ? [win] : candidates.map(named));
  }

  return {
    slotOdds,
    matchOdds,
    decided,
    championOdds: predictions.bracketChampion.map(named),
  };
}

/** Connected circular bracket: merges the shared predictions with real results
 *  and paints them onto the radial skeleton. */
export function CircularBracketWidget() {
  const predictions = usePredictions();
  const results = useResults();
  const view = useMemo(
    () => (predictions ? circularView(predictions, results) : undefined),
    [predictions, results],
  );
  // Market predictions start off; users opt in via the in-card toggle.
  return <CircularBracketCard view={view} />;
}
