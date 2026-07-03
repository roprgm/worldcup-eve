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
        enabled    boolean not null default true,
        created_at timestamptz not null default now(),
        data       jsonb not null
      )
    `;
    await sql`
      create table if not exists arena_brackets (
        id         text primary key,
        name       text,
        created_at timestamptz not null default now(),
        picks      jsonb not null
      )
    `;
    // Backfill columns on tables created before they existed.
    await sql`alter table arena_runs add column if not exists enabled boolean not null default true`;
    await sql`alter table arena_brackets add column if not exists name text`;
  })();
  return schemaReady;
}
