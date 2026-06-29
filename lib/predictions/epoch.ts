// The persisted start-of-day epoch: its `teamStrengths` warm-start the per-minute
// fit (skipping the ~2 s anchor), and its bracket outputs are the baseline the
// bars diff against. Stored privately in Vercel Blob; absent until the first
// daily capture runs.

import type { BracketOutputs } from "./index";
import { readJson, writeJson } from "@/lib/storage/blob";

export type EpochSnapshot = BracketOutputs;

const LATEST_KEY = "predictions/latest.json";

/** The most recent epoch, or null when none has been captured yet. */
export const readLatestEpoch = (): Promise<EpochSnapshot | null> =>
  readJson<EpochSnapshot>(LATEST_KEY);

/** Persist the epoch as the latest pointer and an immutable record for `day`. */
export async function writeEpoch(
  day: string,
  epoch: EpochSnapshot,
): Promise<void> {
  await Promise.all([
    writeJson(LATEST_KEY, epoch),
    writeJson(`predictions/history/${day}.json`, epoch),
  ]);
}
