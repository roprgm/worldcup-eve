// Per-group-fixture predictions from the market's per-match markets: the
// most-likely exact scoreline (Exact Score markets) and the two-way home/away
// win chance (moneyline). Both are forecasts of a single unplayed match.

import { fetchLastTrades, fetchMidpoints } from "./market-api";
import groupCatalogData from "./group-markets.json";

export interface Scoreline {
  h: number; // goals for our fixture's home team
  a: number; // goals for our fixture's away team
}
export interface MatchOdds {
  matchId: string; // group fixture id, e.g. "A1"
  home: string; // FIFA code
  away: string;
  homeWin: number; // P(home wins | not a draw); homeWin + awayWin = 1
  awayWin: number;
}

interface ScoreMarket extends Scoreline {
  token: string; // CLOB "Yes" token for this exact scoreline
}
interface GroupMarket {
  matchId: string;
  homeId: string;
  awayId: string;
  eventId: string;
  moneyline?: { home: string; away: string }; // home/away "wins" Yes tokens
  scores: ScoreMarket[];
}
interface Catalog {
  generatedAt: string;
  matches: GroupMarket[];
}

const groupMarketCatalog = groupCatalogData as Catalog;

export interface GroupMarketsSnapshot {
  /** Most-likely exact scoreline per fixture id (argmax over last-trade prices). */
  scores: Record<string, Scoreline>;
  /** Two-way win chance per fixture that has a priced moneyline. */
  odds: MatchOdds[];
}

export async function fetchGroupMarkets(): Promise<GroupMarketsSnapshot> {
  const scoreTokens = groupMarketCatalog.matches.flatMap((m) =>
    m.scores.map((s) => s.token),
  );
  const oddsTokens = groupMarketCatalog.matches.flatMap((m) =>
    m.moneyline ? [m.moneyline.home, m.moneyline.away] : [],
  );
  const [lastTrade, mid] = await Promise.all([
    fetchLastTrades(scoreTokens),
    fetchMidpoints(oddsTokens),
  ]);

  const scores: Record<string, Scoreline> = {};
  for (const m of groupMarketCatalog.matches) {
    let best: ScoreMarket | null = null;
    let bestPrice = 0;
    for (const s of m.scores) {
      const price = lastTrade.get(s.token) ?? 0;
      if (price > bestPrice) {
        bestPrice = price;
        best = s;
      }
    }
    if (best) scores[m.matchId] = { h: best.h, a: best.a };
  }

  const odds: MatchOdds[] = [];
  for (const m of groupMarketCatalog.matches) {
    if (!m.moneyline) continue;
    const home = mid.get(m.moneyline.home) ?? 0;
    const away = mid.get(m.moneyline.away) ?? 0;
    const total = home + away;
    if (total > 0)
      odds.push({
        matchId: m.matchId,
        home: m.homeId,
        away: m.awayId,
        homeWin: home / total,
        awayWin: away / total,
      });
  }

  return { scores, odds };
}
