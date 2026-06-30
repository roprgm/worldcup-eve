// Merges the shared market predictions with real results into the data the
// circular bracket paints onto its skeleton: per R32 slot the teams that could
// fill it, per match each contender's chance to win it, the real winner of any
// finished match, and the title odds. Pure — mirrors the derivation in the
// interactive home widget (components/widgets/circular-bracket-widget.tsx); kept
// here as a server-safe module the Open Graph image renderer reuses so the card
// and the social image read the bracket the same way.

import type { Predictions } from "@/lib/predictions";
import type { CellPath } from "@/lib/predictions/team-path";
import type { Results } from "@/lib/results";
import { teamById } from "@/lib/tournament";

export interface Candidate {
  code: string;
  name?: string;
  probability: number;
  /** The same team's chance at the start of the day, when known. The bar paints
   *  the shared value in the base colour and the move since in green/red. Absent
   *  for settled/unsnapshotted nodes — the bar is then solid. */
  baseline?: number;
}

/** Everything the bracket paints onto the skeleton: the candidates for each R32
 *  slot, the teams that could reach each match, the real winner of any finished
 *  match, and the title odds. */
export interface CircularBracketView {
  slotOdds: Map<string, Candidate[]>; // "match:side" → R32 occupant candidates
  matchOdds: Map<number, Candidate[]>; // match → each contender's chance to win
  decided: Map<number, Candidate>; // match → real winner, once played
  live: Set<number>; // match numbers currently in progress
  liveLeader: Map<number, string>; // live match → team code currently ahead
  championOdds: Candidate[];
}

/** Road-to-the-final breakdown per team code, for the locked-in teams that still
 *  have a route. A team's flag is tappable only when it has an entry here. */
export type TeamPaths = Map<string, CellPath>;

const named = (c: { code: string; probability: number }): Candidate => ({
  code: c.code,
  name: teamById[c.code]?.name,
  probability: c.probability,
});

const baselineMap = (candidates?: { code: string; probability: number }[]) =>
  candidates && new Map(candidates.map((c) => [c.code, c.probability]));

// Tag each live candidate with its baseline chance (0 if it wasn't on the
// baseline list, absent when there's no baseline at all).
const withBaseline = (
  candidates: { code: string; probability: number }[],
  baseline?: Map<string, number>,
): Candidate[] =>
  candidates.map((c) => {
    if (!baseline) return named(c);
    return { ...named(c), baseline: baseline.get(c.code) ?? 0 };
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

/** Derive the circular view from predictions and (optional) live results. */
export function circularView(
  predictions: Predictions,
  results?: Results,
): CircularBracketView {
  const decided = decidedWinners(results);

  // Start-of-day baseline counterparts, to paint the move since the day's start.
  const baselineSlots = new Map(
    predictions.baseline.slots.map((s) => [
      `${s.match}:${s.side}`,
      baselineMap(s.candidates),
    ]),
  );
  const baselineMatch = new Map(
    Object.entries(predictions.baseline.matchWinOdds).map(([match, cands]) => [
      Number(match),
      baselineMap(cands),
    ]),
  );

  const slotOdds = new Map<string, Candidate[]>();
  for (const slot of predictions.slots) {
    const key = `${slot.match}:${slot.side}`;
    slotOdds.set(key, withBaseline(slot.candidates, baselineSlots.get(key)));
  }

  // Each contender's chance to win the match — a finished match is pinned to
  // its real winner (no baseline split: it's settled).
  const matchOdds = new Map<number, Candidate[]>();
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds)) {
    const num = Number(match);
    const win = decided.get(num);
    matchOdds.set(
      num,
      win ? [win] : withBaseline(candidates, baselineMatch.get(num)),
    );
  }

  const live = new Set<number>();
  const liveLeader = new Map<number, string>();
  for (const m of results?.matches ?? []) {
    if (m.status !== "live") continue;
    live.add(m.n);
    const home = m.home.score ?? 0;
    const away = m.away.score ?? 0;
    if (home > away && m.home.code) liveLeader.set(m.n, m.home.code);
    else if (away > home && m.away.code) liveLeader.set(m.n, m.away.code);
  }

  return {
    slotOdds,
    matchOdds,
    decided,
    live,
    liveLeader,
    championOdds: withBaseline(
      predictions.bracketChampion,
      baselineMap(predictions.baseline.bracketChampion),
    ),
  };
}
