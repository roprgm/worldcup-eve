// Single cached source for the prediction snapshot, shared by the predictions
// API route and the agent. buildPredictions() fetches Polymarket prices and fits
// the Bradley-Terry model (~2s); the fit is the cost, so we reuse its anchor and
// cache the result in the Vercel Runtime Cache — cross-instance, so the page and
// the agent share one build. An in-memory memo covers any non-Vercel runtime.

import { getCache } from "@vercel/functions";

import {
  buildPredictions,
  type PredictionCache,
  type Predictions,
} from "@/lib/predictions";

const TTL_SECONDS = 60; // tune later (KV / longer partial caches) to optimize the BT fit
const anchor: PredictionCache = {};

let cache: ReturnType<typeof getCache> | undefined;
function runtimeCache() {
  if (!process.env.VERCEL) return undefined;
  try {
    cache ??= getCache({ namespace: "predictions" });
  } catch {
    return undefined;
  }
  return cache;
}

let memo: { at: number; data: Predictions } | undefined;

export async function getCachedPredictions(): Promise<Predictions> {
  const rc = runtimeCache();
  if (rc) {
    const cached = await rc.get("snapshot").catch(() => null);
    if (cached !== null) return cached as Predictions;
  }
  if (memo && Date.now() - memo.at < TTL_SECONDS * 1000) return memo.data;

  const data = await buildPredictions(anchor);
  memo = { at: Date.now(), data };
  if (rc)
    await rc
      .set("snapshot", data, { ttl: TTL_SECONDS, tags: ["predictions"] })
      .catch(() => {});
  return data;
}
