// The committed opening (kickoff) R32 odds, shaped like fetchKnockoutMarkets()
// so the bracket simulation can consume them in place of the live market. The
// snapshot in data/ is produced by sync-opening-odds.ts; this only reshapes it.

import {
  pairKey,
  type KnockoutMarketsSnapshot,
  type KnockoutMatchMarket,
} from "./knockout-markets";
import openingData from "../../data/knockout-opening-odds.json";

interface OpeningMatch {
  home: string;
  away: string;
  homeWin: number | null;
  draw: number | null;
  awayWin: number | null;
  homeAdvance: number | null;
  awayAdvance: number | null;
}

/** R32 opening odds as a knockout-markets snapshot, keyed by team pair. No exact
 *  scores were captured at kickoff, so `score` is always absent. */
export function openingKnockoutMarkets(): KnockoutMarketsSnapshot {
  const byPair = new Map<string, KnockoutMatchMarket>();
  for (const m of (openingData as { matches: OpeningMatch[] }).matches) {
    const win: Record<string, number> = {};
    if (m.homeWin != null) win[m.home] = m.homeWin;
    if (m.awayWin != null) win[m.away] = m.awayWin;
    const advance: Record<string, number> = {};
    if (m.homeAdvance != null) advance[m.home] = m.homeAdvance;
    if (m.awayAdvance != null) advance[m.away] = m.awayAdvance;
    byPair.set(pairKey(m.home, m.away), {
      teams: [m.home, m.away],
      win,
      draw: m.draw,
      advance,
    });
  }
  return { byPair };
}
