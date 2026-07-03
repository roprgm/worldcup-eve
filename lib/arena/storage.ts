// Where arena runs live in Vercel Blob: one blob per run, plus a small index
// blob the list page reads. Everything is private JSON, so it no-ops without
// blob credentials (see lib/storage/blob.ts) — the pages just show nothing.

import { readJson, writeJson } from "@/lib/storage/blob";
import { type ArenaRun, type ArenaRunSummary, toSummary } from "./types";

const INDEX_PATH = "arena/index.json";
// Slugs are the shareable run ids (e.g. "gpt-5"): lowercase, url-safe.
const SLUG_RE = /^[a-z0-9][a-z0-9.-]{0,63}$/;
export const runPath = (id: string) => `arena/runs/${id}.json`;

/** A readable, shareable run id from a gateway model id: the provider prefix is
 *  dropped and the rest lowercased to url-safe chars. So "openai/gpt-5" → "gpt-5"
 *  and "google/gemini-2.5-pro" → "gemini-2.5-pro". Re-running a model reuses its
 *  slug, so its run is updated in place. */
export function modelSlug(model: string): string {
  const tail = model.split("/").pop() ?? model;
  return tail
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

/** All run summaries, newest first, or `[]` when nothing is stored. */
export async function readIndex(): Promise<ArenaRunSummary[]> {
  return (await readJson<ArenaRunSummary[]>(INDEX_PATH)) ?? [];
}

/** The full stored run, or `null` for a malformed id or an absent blob. */
export async function readRun(id: string): Promise<ArenaRun | null> {
  if (!SLUG_RE.test(id)) return null;
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
