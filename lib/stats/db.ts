// Neon (serverless Postgres) client for the stats mirror — the queryable copy
// of what already happened that the agent analyzes with SQL. It shares the app
// database, but model-written SQL only ever runs through `readerQuery`, fenced
// to the select-only stats_reader role. With no DATABASE_URL (plain local dev)
// every caller no-ops, so the app runs without a database.

import { neon } from "@neondatabase/serverless";

import { teams } from "../tournament";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const sql = url ? neon(url) : null;

// The no-login role model SQL runs as: select on the stats tables and nothing
// else — it can neither write nor read the rest of the database.
const STATS_READER = "stats_reader";

/** The schema as told to the model — kept next to the DDL below so both change
 *  in the same diff. */
export const SCHEMA_DOC = `Tables (Postgres):
- matches: n (FIFA number 1-104, pk), round ('group','r32','r16','qf','sf','third_place','final'), grp (group letter 'A'-'L', null in knockouts), matchday (1-3, null in knockouts), home_code/away_code (FIFA codes, null while a knockout slot is undecided), home_name/away_name, home_score/away_score (null until kickoff; a level knockout score with a winner_code means penalties), status ('scheduled','live','final'), winner_code (null for draws and unplayed), kickoff (timestamptz), venue
- events (live/played matches only): match_n, seq, minute (45'+2 → 45), stoppage (45'+2 → 2, else null), type ('goal','own_goal','penalty_goal','yellow_card','red_card','substitution',…), team_code, team_name, player, detail
- teams: code (pk), name, grp`;

let schemaReady: Promise<void> | null = null;

/** Create the tables, the reader role, and the static team rows, once per
 *  process and in a single round trip (idempotent) — the store is
 *  self-provisioning, with no separate migration step to run. */
export function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  schemaReady ??= sql
    .transaction([
      sql`
        create table if not exists teams (
          code text primary key,  -- FIFA 3-letter code, e.g. 'ARG'
          name text not null,
          grp  text not null      -- group letter 'A'-'L'
        )
      `,
      sql`
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
      `,
      sql`
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
      `,
      sql.query(`
        do $$ begin
          if not exists (select from pg_roles where rolname = '${STATS_READER}') then
            create role ${STATS_READER};
          end if;
        end $$
      `),
      sql.query(`grant select on teams, matches, events to ${STATS_READER}`),
      // Membership lets the app connection assume the role per query.
      sql.query(`grant ${STATS_READER} to current_user`),
      sql.query(
        `insert into teams (code, name, grp)
         select * from jsonb_to_recordset($1::jsonb) as r(code text, name text, grp text)
         on conflict (code) do nothing`,
        [
          JSON.stringify(
            teams.map((t) => ({ code: t.id, name: t.name, grp: t.group })),
          ),
        ],
      ),
    ])
    .then(() => undefined)
    .catch((e) => {
      // Don't cache a failed init — reset so a later call retries instead of
      // poisoning the promise for the life of the process.
      schemaReady = null;
      throw e;
    });
  return schemaReady;
}

/** Run one untrusted SQL statement with least privilege: as the select-only
 *  reader role, inside a READ ONLY transaction, capped at `maxRows` rows.
 *  All three fences are enforced by Postgres itself, so a hostile statement
 *  can neither write nor see other tables — whatever it says. */
export async function readerQuery(statement: string, maxRows: number) {
  if (!sql) throw new Error("No database configured.");
  await ensureSchema();
  const [, rows] = await sql.transaction(
    [
      sql.query(`set local role ${STATS_READER}`),
      sql.query(`select * from (\n${statement}\n) as q limit ${maxRows + 1}`),
    ],
    { readOnly: true },
  );
  return { rows: rows.slice(0, maxRows), truncated: rows.length > maxRows };
}
