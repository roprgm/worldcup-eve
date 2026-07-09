// Neon (serverless Postgres) client for the stats mirror — the queryable copy
// of what already happened that the agent analyzes with SQL. Shares the app
// database; the model's queries are fenced off by the self-provisioned
// STATS_READER role (select on these tables only), assumed per query by the
// `query` tool. With no DATABASE_URL (plain local dev) every caller no-ops, so
// the app runs without a database.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const sql = url ? neon(url) : null;

/** The no-login role the agent's SQL runs as: select on the stats tables,
 *  nothing else — it cannot write, nor read the rest of the database. */
export const STATS_READER = "stats_reader";

let schemaReady: Promise<void> | null = null;

/** Create the tables once per process (idempotent), so the store is
 *  self-provisioning — no separate migration step to run. */
export function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql`
      create table if not exists teams (
        code text primary key,  -- FIFA 3-letter code, e.g. 'ARG'
        name text not null,
        grp  text not null      -- group letter 'A'-'L'
      )
    `;
    await sql`
      create table if not exists matches (
        n             int primary key,  -- FIFA match number 1-104
        round         text not null,    -- group | r32 | r16 | qf | sf | third_place | final
        grp           text,             -- group letter, null from the round of 32 on
        matchday      int,              -- 1-3 within the group, null in knockouts
        home_code     text,             -- null while a knockout slot is undecided
        home_name     text,
        away_code     text,
        away_name     text,
        home_score    int,              -- null until kickoff
        away_score    int,
        status        text not null,    -- scheduled | live | final
        winner_code   text,             -- null for group draws and unplayed matches
        kickoff       timestamptz not null,
        venue         text not null,
        events_synced boolean not null default false
      )
    `;
    await sql`
      create table if not exists events (
        match_n   int not null references matches(n),
        seq       int not null,  -- feed order within the match
        minute    int,           -- regulation minute: "45'+2'" is minute 45
        stoppage  int,           -- added-time minutes ("45'+2'" is 2), else null
        type      text not null, -- goal | own_goal | penalty_goal | yellow_card | red_card | substitution | ...
        team_code text,
        team_name text,
        player    text,
        detail    text,          -- the feed's full sentence for the event
        primary key (match_n, seq)
      )
    `;
    await sql`
      do $$ begin
        if not exists (select from pg_roles where rolname = 'stats_reader') then
          create role stats_reader;
        end if;
      end $$
    `;
    await sql`grant select on teams, matches, events to stats_reader`;
    // Membership lets the app connection SET LOCAL ROLE to it per query.
    await sql`grant stats_reader to current_user`;
  })().catch((e) => {
    // Don't cache a failed init — reset so a later call retries instead of
    // poisoning the promise for the life of the process.
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}
