// Capture each Round-of-32 match's *opening* market odds — the three-way
// (home/draw/away) regulation price at kickoff — into data/. For played or live
// games we read the price at the kickoff timestamp from Polymarket's price
// history; for games not yet started we snapshot the current price (which is
// effectively their opening price). Build-time tool, run in dev to refresh:
//   bun run lib/predictions/sync-opening-odds.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { knockoutMatches } from "../tournament";
import { getMatchResults } from "../results";
import { fetchMidpoints } from "./market-api";
import { pairKey } from "./knockout-markets";
import knockoutCatalogData from "./knockout-markets.json";

const CLOB = "https://clob.polymarket.com";
const OUT = new URL("../../data/knockout-opening-odds.json", import.meta.url);
// How far before kickoff to accept the last quote, when no point lands on it.
const LOOKBACK_S = 3 * 3600;

interface KnockoutMarket {
  teams: string[];
  win: Record<string, string>; // team code → "Will X win?" Yes token
  draw?: string;
}
const marketByPair = new Map<string, KnockoutMarket>(
  (knockoutCatalogData as unknown as { matches: KnockoutMarket[] }).matches.map(
    (m) => [pairKey(m.teams[0], m.teams[1]), m],
  ),
);

const round4 = (x: number | null) =>
  x == null ? null : Math.round(x * 1e4) / 1e4;

// Two-way share of a Yes price against its opposite (the draw split in
// proportion to each side's win odds), matching the live `advance` derivation.
const twoWay = (a: number | null, b: number | null) =>
  a != null && b != null && a + b > 0 ? a / (a + b) : null;

// Yes price at (or just before) `ts` from a token's CLOB history; null if none.
async function priceAt(token: string, ts: number): Promise<number | null> {
  const res = await fetch(
    `${CLOB}/prices-history?market=${token}&startTs=${ts - LOOKBACK_S}&endTs=${ts + 60}&fidelity=1`,
  );
  if (!res.ok) return null;
  const { history = [] } = (await res.json()) as {
    history?: { t: number; p: number }[];
  };
  const before = history.filter((h) => h.t <= ts);
  return (before.at(-1) ?? history[0])?.p ?? null;
}

interface OpeningOdds {
  match: number; // FIFA match number (73–88)
  home: string;
  away: string;
  kickoff: string;
  status: "scheduled" | "live" | "final";
  source: "kickoff" | "current"; // price at kickoff, or a current snapshot
  homeWin: number | null; // P(home wins in regulation)
  draw: number | null;
  awayWin: number | null;
  homeAdvance: number | null; // two-way (home/away) advance share
  awayAdvance: number | null;
}

async function main(): Promise<void> {
  const results = await getMatchResults();
  const r32 = new Set(
    knockoutMatches.filter((m) => m.round === "R32").map((m) => m.number),
  );
  const matches = results.matches.filter((m) => r32.has(m.n));

  // Not-yet-started games take their current price; fetch those in one batch.
  const currentTokens = matches.flatMap((m) => {
    if (m.status !== "scheduled") return [];
    const mk = marketByPair.get(pairKey(m.home.code, m.away.code));
    return mk ? [...Object.values(mk.win), ...(mk.draw ? [mk.draw] : [])] : [];
  });
  const current = currentTokens.length
    ? await fetchMidpoints(currentTokens)
    : new Map<string, number>();

  const out: OpeningOdds[] = [];
  for (const m of matches) {
    const mk = marketByPair.get(pairKey(m.home.code, m.away.code));
    if (!mk) {
      console.warn(
        `match ${m.n} ${m.home.code}-${m.away.code}: no market, skipped`,
      );
      continue;
    }
    const source = m.status === "scheduled" ? "current" : "kickoff";
    const kickoffTs = m.kickoff
      ? Math.floor(Date.parse(m.kickoff) / 1000)
      : null;
    const price = (token?: string): Promise<number | null> => {
      if (!token) return Promise.resolve(null);
      if (source === "current")
        return Promise.resolve(current.get(token) ?? null);
      return kickoffTs == null
        ? Promise.resolve(null)
        : priceAt(token, kickoffTs);
    };

    const [homeWin, awayWin, draw] = await Promise.all([
      price(mk.win[m.home.code]),
      price(mk.win[m.away.code]),
      price(mk.draw),
    ]);
    out.push({
      match: m.n,
      home: m.home.code,
      away: m.away.code,
      kickoff: m.kickoff ?? "",
      status: m.status,
      source,
      homeWin: round4(homeWin),
      draw: round4(draw),
      awayWin: round4(awayWin),
      homeAdvance: round4(twoWay(homeWin, awayWin)),
      awayAdvance: round4(twoWay(awayWin, homeWin)),
    });
  }
  out.sort((a, b) => a.match - b.match);

  mkdirSync(new URL("../../data/", import.meta.url), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), matches: out }, null, 2)}\n`,
  );
  console.log(`Wrote ${OUT.pathname}: ${out.length} R32 matches`);
}

await main();
