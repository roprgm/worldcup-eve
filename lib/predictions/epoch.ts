// The persisted "epoch": the prediction snapshot captured at the start of each
// tournament day. Two uses: its `teamStrengths` warm-start the per-minute
// Bradley-Terry fit (skipping the ~2 s cold anchor), and its bracket outputs are
// the before/after baseline the bracket bars diff against. Stored privately in
// Vercel Blob; absent until the first daily capture runs.

import { getCache } from "@vercel/functions";

import { readJson, writeJson } from "@/lib/storage/blob";
import type { Predictions } from "./index";

// The stored artifact is a full snapshot WITHOUT its own `baseline`, so a file
// never nests the previous day's snapshot and stays flat day over day.
export type EpochSnapshot = Omit<Predictions, "baseline">;

const LATEST_KEY = "predictions/latest.json";
const historyKey = (day: string) => `predictions/history/${day}.json`;

// Memoise the latest epoch in the Runtime Cache (cross-instance) so the
// per-minute refresh doesn't re-read blob on every tick — it only changes once a
// day. The daily capture primes this key, so a new epoch is picked up at once.
const EPOCH_TTL = 300; // 5 min, far below the daily cadence
const epochCache = getCache({ namespace: "predictions-epoch" });

/** The most recent persisted epoch, or null when none has been captured yet. */
export async function readLatestEpoch(): Promise<EpochSnapshot | null> {
  const hit = await epochCache.get("latest");
  if (hit != null) return hit as EpochSnapshot;
  const snapshot = await readJson<EpochSnapshot>(LATEST_KEY);
  if (snapshot)
    await epochCache.set("latest", snapshot, {
      ttl: EPOCH_TTL,
      tags: ["predictions-epoch"],
    });
  return snapshot;
}

/** Persist `snapshot` as both the immutable record for `day` and the latest
 *  pointer, then prime the cache so the next refresh sees it immediately. */
export async function writeEpoch(
  day: string,
  snapshot: EpochSnapshot,
): Promise<void> {
  await Promise.all([
    writeJson(historyKey(day), snapshot),
    writeJson(LATEST_KEY, snapshot),
  ]);
  await epochCache.set("latest", snapshot, {
    ttl: EPOCH_TTL,
    tags: ["predictions-epoch"],
  });
}
