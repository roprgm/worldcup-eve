// Single cached source for the prediction snapshot, shared by the predictions API
// route and the agent. The anchor fit is the cost (~2s), so we persist its weights
// in the Vercel Runtime Cache — durable across deploys — and warm-start from them.
// The live snapshot is cached short; the anchor base long, so it outlives it.

import { getCache } from "@vercel/functions";

import {
  buildPredictions,
  catalog,
  type PredictionCache,
  type Predictions,
} from "@/lib/predictions";
import {
  deserializeStrengths,
  serializeStrengths,
  type StrengthsBlob,
} from "@/lib/predictions/bradley-terry";

const SNAPSHOT_TTL = 60; // live snapshot: prices move fast
const ANCHOR_TTL = 60 * 60 * 24; // durable warm-start base, refreshed every build

// Key the base by catalog generation: it only stays a good warm-start while the
// market structure is unchanged, and generatedAt bumps when `sync:markets` adds or
// settles markets. Bump ANCHOR_VERSION when the blob format or the fit changes.
const ANCHOR_VERSION = "v1";
const anchorKey = () => `anchor:${ANCHOR_VERSION}:${catalog.generatedAt}`;

// In-memory base; survives within a warm instance, not across deploys.
const anchor: PredictionCache = {};
let anchorKeyLoaded: string | undefined;

let snapshots: ReturnType<typeof getCache> | undefined;
let bases: ReturnType<typeof getCache> | undefined;
function caches() {
  if (!process.env.VERCEL) return {};
  try {
    snapshots ??= getCache({ namespace: "predictions" });
    bases ??= getCache({ namespace: "predictions-anchor" });
  } catch {
    return {};
  }
  return { snapshots, bases };
}

// Load the persisted base for the current key. On a generation change, drop the
// stale base so the build recomputes the anchor when the store has nothing new.
async function loadAnchor(bases?: ReturnType<typeof getCache>) {
  const key = anchorKey();
  if (anchorKeyLoaded === key && anchor.anchor) return;
  if (anchorKeyLoaded !== key) anchor.anchor = undefined;
  anchorKeyLoaded = key;

  if (!bases || anchor.anchor) return;
  const blob = (await bases.get(key).catch(() => null)) as StrengthsBlob | null;
  if (blob) anchor.anchor = deserializeStrengths(blob);
}

// Persist the anchor under the current key so cold starts and redeploys reuse it
// (and refresh its TTL while the app is active). It's the same value each build —
// fitStrengths warm-starts from it without mutating it — so the snapshot stays
// deterministic: identical prices yield identical output, cold or warm.
async function saveAnchor(bases?: ReturnType<typeof getCache>) {
  if (!bases || !anchor.anchor) return;
  await bases
    .set(anchorKey(), serializeStrengths(anchor.anchor), {
      ttl: ANCHOR_TTL,
      tags: ["predictions-anchor"],
    })
    .catch(() => {});
}

let memo: { at: number; data: Predictions } | undefined;

export async function getCachedPredictions(): Promise<Predictions> {
  const { snapshots, bases } = caches();

  if (snapshots) {
    const cached = await snapshots.get("snapshot").catch(() => null);
    if (cached !== null) return cached as Predictions;
  }
  if (memo && Date.now() - memo.at < SNAPSHOT_TTL * 1000) return memo.data;

  await loadAnchor(bases);
  const data = await buildPredictions(anchor);
  memo = { at: Date.now(), data };

  if (snapshots)
    await snapshots
      .set("snapshot", data, { ttl: SNAPSHOT_TTL, tags: ["predictions"] })
      .catch(() => {});
  await saveAnchor(bases);
  return data;
}
