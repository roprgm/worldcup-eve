// Per-knockout-fixture predictions from Polymarket's per-game markets: the
// most-likely exact scoreline and the three-way (home/draw/away) regulation
// odds, plus the two-way advance odds those imply. Unlike the BT model, this is
// the market's *direct* read of an actual matchup — no inference. Keyed by team
// pair; the bracket position is resolved by the caller from the live slots.

import { fetchLastTrades, fetchMidpoints } from "./market-api";
import knockoutCatalogData from "./knockout-markets.json";

interface ScoreMarket {
  a: number; // goals for teams[0]
  b: number; // goals for teams[1]
  token: string;
}
interface KnockoutMarket {
  teams: string[]; // [teams[0], teams[1]], the market's own order
  eventId: string;
  win: Record<string, string>; // team code → "win" Yes token
  draw?: string;
  scores: ScoreMarket[];
}
interface Catalog {
  generatedAt: string;
  matches: KnockoutMarket[];
}

const catalog = knockoutCatalogData as unknown as Catalog;

export interface KnockoutMatchMarket {
  teams: [string, string];
  /** P(team wins in regulation) per code; with the draw they sum to ~1. */
  win: Record<string, number>;
  draw: number | null;
  /** P(team advances) = win share renormalised two-way (the draw split in
   *  proportion to each side's win odds). Sums to 1 across the pair. */
  advance: Record<string, number>;
  /** Most-likely exact scoreline: goals for teams[0] (`a`) and teams[1] (`b`). */
  score?: { a: number; b: number };
}

/** Order-independent key for a team pair. */
export const pairKey = (a: string, b: string): string =>
  [a, b].sort().join("|");

export interface KnockoutMarketsSnapshot {
  /** Direct market read per knockout fixture, keyed by `pairKey`. */
  byPair: Map<string, KnockoutMatchMarket>;
}

export async function fetchKnockoutMarkets(): Promise<KnockoutMarketsSnapshot> {
  const scoreTokens = catalog.matches.flatMap((m) =>
    m.scores.map((s) => s.token),
  );
  const oddsTokens = catalog.matches.flatMap((m) => [
    ...Object.values(m.win),
    ...(m.draw ? [m.draw] : []),
  ]);
  const [lastTrade, mid] = await Promise.all([
    fetchLastTrades(scoreTokens),
    fetchMidpoints(oddsTokens),
  ]);

  const byPair = new Map<string, KnockoutMatchMarket>();
  for (const m of catalog.matches) {
    const [a, b] = m.teams;

    const win: Record<string, number> = {};
    for (const [code, token] of Object.entries(m.win)) {
      const p = mid.get(token);
      if (p != null) win[code] = p;
    }
    const draw = m.draw ? (mid.get(m.draw) ?? null) : null;

    const wa = win[a] ?? 0;
    const wb = win[b] ?? 0;
    const advance: Record<string, number> = {};
    if (wa + wb > 0) {
      advance[a] = wa / (wa + wb);
      advance[b] = wb / (wa + wb);
    }

    let best: ScoreMarket | null = null;
    let bestPrice = 0;
    for (const s of m.scores) {
      const price = lastTrade.get(s.token) ?? 0;
      if (price > bestPrice) {
        bestPrice = price;
        best = s;
      }
    }

    byPair.set(pairKey(a, b), {
      teams: [a, b],
      win,
      draw,
      advance,
      ...(best ? { score: { a: best.a, b: best.b } } : {}),
    });
  }

  return { byPair };
}
