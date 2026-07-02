// Per-knockout-fixture predictions from Polymarket's per-game markets: the
// full exact-score distribution and the three-way (home/draw/away) regulation
// odds. Unlike the BT model, this is the market's *direct* read of an actual
// matchup — no inference. The two-way "to advance" odds aren't derived here:
// a knockout can draw in regulation yet still send a team through, so the caller
// reads those from the reach-the-next-round future instead. Keyed by team pair;
// the bracket position is resolved by the caller from the live slots.

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

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

export interface ScoreChance {
  a: number; // goals for teams[0]
  b: number; // goals for teams[1]
  p: number; // chance of this scoreline, normalized over the listed ones
}

export interface KnockoutMatchMarket {
  teams: [string, string];
  /** P(team wins in regulation) per code; with the draw they sum to ~1. */
  win: Record<string, number>;
  draw: number | null;
  /** Every listed scoreline's chance, sorted most-likely first; empty while
   *  the exact-score market has no trades. */
  scores: ScoreChance[];
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

    // Last-trade prices carry noise and vig, so normalize into a distribution
    // over the listed scorelines (there's no "any other score" outcome).
    const priced = m.scores.map((s) => ({
      a: s.a,
      b: s.b,
      p: lastTrade.get(s.token) ?? 0,
    }));
    const total = priced.reduce((sum, s) => sum + s.p, 0);
    const scores =
      total > 0
        ? priced
            .map((s) => ({ ...s, p: round4(s.p / total) }))
            .sort((x, y) => y.p - x.p)
        : [];

    byPair.set(pairKey(a, b), { teams: [a, b], win, draw, scores });
  }

  return { byPair };
}
