// Live market prices for the catalog markets. Open markets are read from the
// CLOB; settled ones the CLOB no longer prices fall back to Gamma. Every call is
// scheduled through a Bottleneck limiter because the market API throttles by request
// rate over a rolling 10 s window. Returns conditionId → Yes price in [0, 1].

import Bottleneck from "bottleneck";
import catalogData from "./markets.json";

const CLOB = "https://clob.polymarket.com";
const GAMMA = "https://gamma-api.polymarket.com";

// One limiter per API, sized just under the documented caps (CLOB 9000 / 10 s,
// Gamma 4000 / 10 s); maxConcurrent is only a socket-storm guard.
const window = (perWindow: number) =>
  new Bottleneck({
    reservoir: perWindow,
    reservoirRefreshAmount: perWindow,
    reservoirRefreshInterval: 10_000,
    maxConcurrent: 10,
  });
const clobLimiter = window(8000);
const gammaLimiter = window(3500);

const clobFetch = (path: string, init?: RequestInit) =>
  clobLimiter.schedule(() => fetch(`${CLOB}${path}`, init));
export const gammaFetch = (path: string, init?: RequestInit) =>
  gammaLimiter.schedule(() => fetch(`${GAMMA}${path}`, init));

export interface CatalogMarket {
  kind: string;
  group?: string;
  code: string;
  conditionId: string;
  yesToken: string;
  eventId: string;
  /** Final Yes price (0/1) baked in by sync once resolved; if present the runtime never re-queries it. */
  settled?: number;
}
export interface Catalog {
  generatedAt: string;
  markets: CatalogMarket[];
}

export const catalog = catalogData as Catalog;

const toPrice = (v: unknown): number | null =>
  Number.isFinite(Number(v)) ? Number(v) : null;

// A CLOB midpoint row: a bare number/string, or an object carrying the price.
type MidValue =
  | string
  | number
  | {
      mid?: string | number;
      midpoint?: string | number;
      price?: string | number;
    };
const toMid = (v: MidValue): number | null =>
  toPrice(v && typeof v === "object" ? (v.mid ?? v.midpoint ?? v.price) : v);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

function gammaYesPrice(market: {
  outcomes: string;
  outcomePrices: string;
}): number | null {
  try {
    const yes = (JSON.parse(market.outcomes) as string[]).indexOf("Yes");
    return yes >= 0
      ? toPrice((JSON.parse(market.outcomePrices) as string[])[yes])
      : null;
  } catch {
    return null;
  }
}

/** CLOB last-trade price per token (missing tokens count as 0); used for exact scores. */
export async function fetchLastTrades(
  tokens: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const batch of chunk(tokens, 500)) {
    try {
      const res = await clobFetch("/last-trades-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((token_id) => ({ token_id }))),
      });
      if (!res.ok) continue;
      for (const row of (await res.json()) as {
        token_id: string;
        price: string;
      }[]) {
        const price = toPrice(row.price);
        if (price != null) out.set(row.token_id, price);
      }
    } catch {
      // batch failed — its tokens count as 0
    }
  }
  return out;
}

/** CLOB midpoints per token, batched (the CLOB limit is 500 per call). */
export async function fetchMidpoints(
  tokens: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const batch of chunk(tokens, 500)) {
    try {
      const res = await clobFetch("/midpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((token_id) => ({ token_id }))),
        cache: "no-store",
      });
      if (!res.ok) continue;
      // CLOB answers as a { token_id, … } array or a token→value map; normalise both.
      const data = (await res.json()) as MidValue[] | Record<string, MidValue>;
      const entries = Array.isArray(data)
        ? data.map(
            (row) => [(row as { token_id?: string }).token_id, row] as const,
          )
        : Object.entries(data);
      for (const [token, value] of entries) {
        const price = toMid(value);
        if (token && price != null) out.set(token, price);
      }
    } catch {
      // batch failed — its markets fall through to Gamma
    }
  }
  return out;
}

/** Gamma Yes prices for settled/illiquid markets, one request per event. */
export async function fetchGammaPrices(
  markets: CatalogMarket[],
): Promise<Map<string, number>> {
  const wanted = new Set(markets.map((m) => m.conditionId));
  const out = new Map<string, number>();
  await Promise.all(
    [...new Set(markets.map((m) => m.eventId))].map(async (eventId) => {
      try {
        const res = await gammaFetch(`/events?id=${eventId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const events = (await res.json()) as Array<{
          markets?: Array<{
            conditionId: string;
            outcomes: string;
            outcomePrices: string;
          }>;
        }>;
        for (const event of events)
          for (const market of event.markets ?? [])
            if (wanted.has(market.conditionId)) {
              const price = gammaYesPrice(market);
              if (price != null) out.set(market.conditionId, price);
            }
      } catch {
        // whole event unavailable — its markets stay unpriced this run
      }
    }),
  );
  return out;
}

/** conditionId → current Yes price. Settled markets come from the catalog; only
 * open ones hit the CLOB, with Gamma covering anything that settled since sync. */
export async function fetchPrices(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const open: CatalogMarket[] = [];
  for (const m of catalog.markets) {
    if (m.settled != null) prices.set(m.conditionId, m.settled);
    else open.push(m);
  }

  const mids = await fetchMidpoints(open.map((m) => m.yesToken));
  for (const m of open) {
    const mid = mids.get(m.yesToken);
    if (mid != null) prices.set(m.conditionId, mid);
  }

  const missing = open.filter((m) => !prices.has(m.conditionId));
  if (missing.length)
    for (const [id, price] of await fetchGammaPrices(missing))
      prices.set(id, price);
  return prices;
}
