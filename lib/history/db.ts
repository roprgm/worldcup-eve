// Neon (serverless Postgres) client for the history tables, following the same
// self-provisioning pattern as the arena: tables are created on first use, and
// with no DATABASE_URL (plain local dev) `sql` is null so callers can no-op.
//
// Matches are keyed by (date, home_team, away_team) — the natural key of the
// upstream dataset (two nations never meet twice on one day) — so goals and
// shootouts reference their match by the same triple and the sync can mirror
// the source files without inventing ids.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const sql = url ? neon(url) : null;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    // Every men's full international since 1872. `stage` ("Final",
    // "Semi-finals", "Group stage", ...) is filled for World Cup matches only.
    await sql`
      create table if not exists history_matches (
        date       date not null,
        home_team  text not null,
        away_team  text not null,
        home_score smallint not null,
        away_score smallint not null,
        tournament text not null,
        city       text not null,
        country    text not null,
        neutral    boolean not null,
        stage      text,
        primary key (date, home_team, away_team)
      )
    `;
    await sql`create index if not exists history_matches_home_team on history_matches (home_team)`;
    await sql`create index if not exists history_matches_away_team on history_matches (away_team)`;
    await sql`create index if not exists history_matches_tournament on history_matches (tournament)`;
    await sql`
      create table if not exists history_goals (
        date      date not null,
        home_team text not null,
        away_team text not null,
        team      text not null,
        scorer    text,
        minute    smallint,
        own_goal  boolean not null,
        penalty   boolean not null,
        foreign key (date, home_team, away_team)
          references history_matches on delete cascade
      )
    `;
    await sql`create index if not exists history_goals_match on history_goals (date, home_team, away_team)`;
    await sql`create index if not exists history_goals_team on history_goals (team)`;
    await sql`
      create table if not exists history_shootouts (
        date          date not null,
        home_team     text not null,
        away_team     text not null,
        winner        text not null,
        first_shooter text,
        primary key (date, home_team, away_team),
        foreign key (date, home_team, away_team)
          references history_matches on delete cascade
      )
    `;
    // Country renames ("Zaire" → "DR Congo"): matches store the current name,
    // this maps it back to what the team was called on a given date.
    await sql`
      create table if not exists history_team_names (
        current_name text not null,
        former_name  text not null,
        start_date   date not null,
        end_date     date not null,
        primary key (current_name, former_name, start_date)
      )
    `;
  })().catch((e) => {
    // Don't cache a failed init — reset so a later call retries instead of
    // poisoning the promise for the life of the process.
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}
