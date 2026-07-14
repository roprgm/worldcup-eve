// Schema for the arena tables. Tiny and flexible — the full run lives in a
// `jsonb` column, so the schema never has to change as the run shape evolves.
// The client comes from lib/db — null without a DATABASE_URL (plain local
// dev), so every caller no-ops and the app still runs without a database.

import { sql } from "@/lib/db";

export { sql };

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
  })().catch((e) => {
    // Don't cache a failed init — reset so a later call retries instead of
    // poisoning the promise for the life of the process.
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}
