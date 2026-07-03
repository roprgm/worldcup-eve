// Neon (serverless Postgres) client for the arena. One tiny, flexible table —
// the full run lives in a `jsonb` column, so the schema never has to change as
// the run shape evolves. With no DATABASE_URL (plain local dev) every caller
// no-ops, so the app still runs without a database.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const sql = url ? neon(url) : null;

let schemaReady: Promise<void> | null = null;

/** Create the tables once per process (idempotent), so the store is
 *  self-provisioning — no separate migration step to run. `arena_runs` holds the
 *  model benchmark runs; `arena_brackets` holds human-made shared predictions
 *  (just the picks — no model, tokens or reasoning). */
export function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql`
      create table if not exists arena_runs (
        id         text primary key,
        model      text not null,
        created_at timestamptz not null default now(),
        data       jsonb not null
      )
    `;
    await sql`
      create table if not exists arena_brackets (
        id         text primary key,
        created_at timestamptz not null default now(),
        picks      jsonb not null
      )
    `;
  })();
  return schemaReady;
}
