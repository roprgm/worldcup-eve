// Where arena runs live in Vercel Blob: one blob per run, plus a small index
// blob the list page reads. Everything is private JSON, so it no-ops without
// blob credentials (see lib/storage/blob.ts) — the pages just show nothing.

import { readJson, writeJson } from "@/lib/storage/blob";
import { type ArenaRun, type ArenaRunSummary, toSummary } from "./types";

const INDEX_PATH = "arena/index.json";
const ID_RE = /^[a-f0-9]{12}$/;
export const runPath = (id: string) => `arena/runs/${id}.json`;

/** All run summaries, newest first, or `[]` when nothing is stored. */
export async function readIndex(): Promise<ArenaRunSummary[]> {
  return (await readJson<ArenaRunSummary[]>(INDEX_PATH)) ?? [];
}

/** The full stored run, or `null` for a malformed id or an absent blob. */
export async function readRun(id: string): Promise<ArenaRun | null> {
  if (!ID_RE.test(id)) return null;
  return (await readJson<ArenaRun>(runPath(id))) ?? null;
}

/** Persist a run blob and add its summary to the front of the index (newest
 *  first). Returns whether both writes succeeded. */
export async function saveRun(run: ArenaRun): Promise<boolean> {
  const stored = await writeJson(runPath(run.id), run);
  if (!stored) return false;
  const index = await readIndex();
  const next = [toSummary(run), ...index.filter((r) => r.id !== run.id)];
  return writeJson(INDEX_PATH, next);
}
