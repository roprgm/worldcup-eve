# stats

The queryable mirror of what already *happened* this World Cup: every match and
its event timeline, in plain Postgres tables the agent analyzes with SQL through
its `query` tool. The `results` module answers "what is the score right now";
this one answers "which match had the most goals" without scanning 104 fixtures
through the model's context.

## Pieces

- `db.ts` — the Neon client, the self-provisioning schema (same pattern as
  `arena/db.ts`: one idempotent transaction per process, no migration step,
  no-ops without a `DATABASE_URL`), and `readerQuery` — the only door model SQL
  goes through. The schema itself is documented where it lives: the commented
  DDL and the model-facing `SCHEMA_DOC` sit side by side in this file.
- `sync.ts` — `syncStats()`, one idempotent pass: bulk-upsert all 104 matches
  from the `results` scoreboard, then fetch event timelines for live matches and
  not-yet-ingested finals (capped per run; a backlog backfills itself across
  runs). Live matches re-sync every pass — VAR can rewrite a timeline — and a
  final is ingested once (`events_synced`). Driven by the
  `agent/schedules/sync-stats.ts` cron every minute.

Group scores are oriented to *our* fixtures (via `results`' `groupScores`);
knockout sides use the feed's orientation. The database is shared with the rest
of the app, but the model never touches it with app privileges: `readerQuery`
runs each statement as `stats_reader` (a no-login role that can select the
three stats tables and nothing else) inside a `READ ONLY` transaction,
row-capped by a wrapping select — three fences, all enforced by Postgres rather
than by inspecting the SQL. The agent's `query` tool adds the model-facing
contract on top: single SELECT/WITH statements, and errors returned as data
(with a schema hint) so the model repairs and retries.
