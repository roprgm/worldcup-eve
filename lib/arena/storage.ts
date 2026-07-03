// Arena runs, stored in Neon: one row per run, the whole run as jsonb. The list
// is a query (no hand-maintained index file), and the summary each list row
// needs is projected out in SQL so the heavy conversation is never fetched.

import { ensureSchema, sql } from "./db";
import type { ArenaRun, ArenaRunSummary } from "./types";

// Slugs are the shareable run ids (e.g. "gpt-5"): lowercase, url-safe.
const SLUG_RE = /^[a-z0-9][a-z0-9.-]{0,63}$/;

/** A readable, shareable run id from a gateway model id: the provider prefix is
 *  dropped and the rest lowercased to url-safe chars. So "openai/gpt-5" → "gpt-5"
 *  and "google/gemini-2.5-pro" → "gemini-2.5-pro". Re-running a model reuses its
 *  slug, so its row is updated in place. */
export function modelSlug(model: string): string {
  const tail = model.split("/").pop() ?? model;
  return tail
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

// The lightweight per-run projection the list needs, built in SQL so the run's
// conversation and questions never leave the database.
const SUMMARY = `jsonb_build_object(
  'id', data->'id',
  'model', data->'model',
  'label', data->'label',
  'createdAt', data->'createdAt',
  'durationMs', data->'durationMs',
  'usage', data->'usage',
  'picks', data->'picks',
  'champion', data->'champion',
  'questionCount', jsonb_array_length(data->'questions'),
  'error', data->'error'
)`;

/** All run summaries, newest first, or `[]` when the store is empty or absent. */
export async function readIndex(): Promise<ArenaRunSummary[]> {
  if (!sql) return [];
  await ensureSchema();
  const rows = await sql.query(
    `select ${SUMMARY} as summary from arena_runs order by created_at desc`,
  );
  return rows.map((r) => r.summary as ArenaRunSummary);
}

/** The full stored run, or `null` for a malformed id or an absent row. */
export async function readRun(id: string): Promise<ArenaRun | null> {
  if (!sql || !SLUG_RE.test(id)) return null;
  await ensureSchema();
  const rows = await sql`select data from arena_runs where id = ${id}`;
  return (rows[0]?.data as ArenaRun) ?? null;
}

/** Upsert a run by id, so re-running a model updates its row. Returns whether it
 *  was stored. */
export async function saveRun(run: ArenaRun): Promise<boolean> {
  if (!sql) return false;
  await ensureSchema();
  await sql`
    insert into arena_runs (id, model, created_at, data)
    values (${run.id}, ${run.model}, ${run.createdAt}, ${JSON.stringify(run)}::jsonb)
    on conflict (id) do update set
      model = excluded.model,
      created_at = excluded.created_at,
      data = excluded.data
  `;
  return true;
}
