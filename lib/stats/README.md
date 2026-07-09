# stats

The queryable mirror of what already *happened* this World Cup: every match and
its event timeline, in plain Postgres tables the agent analyzes with SQL through
its `query` tool. The `results` module answers "what is the score right now";
this one answers "which match had the most goals" without scanning 104 fixtures
through the model's context.

## Pieces

- `db.ts` — the Neon client and self-provisioning schema (same pattern as
  `arena/db.ts`): no migration step, and every caller no-ops without a
  connection string. Prefers `STATS_DATABASE_URL` (a dedicated project, so the
  stats mirror stays apart from the app database) and falls back to
  `DATABASE_URL`.
- `sync.ts` — `syncStats()`, one idempotent pass: bulk-upsert all 104 matches
  from the `results` scoreboard, then fetch event timelines for live matches and
  not-yet-ingested finals (capped per run; a backlog backfills itself across
  runs). Live matches re-sync every pass — VAR can rewrite a timeline — and a
  final is ingested once (`events_synced`). Driven by the
  `agent/schedules/sync-stats.ts` cron every minute.

## Schema

| table | row | notes |
| ----- | --- | ----- |
| `matches` | one per FIFA match number 1–104 | `round`, `grp`/`matchday` (group stage only), sides as FIFA `*_code` + `*_name` (null while a knockout slot is undecided), scores (null until kickoff), `status`, `winner_code` (covers penalty shoot-outs: level score + winner), `kickoff`, `venue` |
| `events` | one per timeline incident | `minute`/`stoppage` ("45'+2'" → 45/2), normalized `type` (`goal`, `own_goal`, `penalty_goal`, `yellow_card`, `red_card`, `substitution`, …), team, `player`, and the feed's `detail` sentence |
| `teams` | one per team | `code`, `name`, `grp` |

Group scores are oriented to *our* fixtures (via `results`' `groupScores`);
knockout sides use the feed's orientation. Read access for the agent goes
through a `READ ONLY` transaction in the `query` tool, so the connection never
needs a write-capable role on the agent's path.
