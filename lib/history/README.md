# history

Every men's full international since 1872, synced into Postgres so the agent
can answer questions like "how many finals did Argentina reach?", "how often
did Argentina play England?" or "how many first-half goals did Argentina score
at World Cups?".

Two public-domain (CC0) sources — no keys, no fees, no attribution required:

- [martj42/international_results](https://github.com/martj42/international_results) —
  every match, goal (scorer and minute) and penalty shootout, updated within
  days of matches being played.
- [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) —
  the round each World Cup match was played in ("Final", "Semi-finals", ...),
  which the results dataset doesn't carry.

## Sync

```bash
DATABASE_URL=postgres://... bun run sync:history
```

A run fetches both sources and rebuilds all four tables in one transaction
(~50k matches, ~48k goals, a few seconds). There is no incremental state:
re-running is always safe, and refreshing after a matchday is the same command.
The schema self-provisions on first run — no migration step.

## Keeping up with the current Cup

The historical sources publish results a few days after they're played, so a
full sync alone would miss a final from last night. `live.ts` closes the gap:
every ten minutes (`agent/schedules/refresh-history.ts`) it upserts this Cup's
finished matches — score and stage — straight from the live results feed,
keyed to agree with the rows the sources eventually publish (local-calendar
dates, their team spellings, the orientation of any row already in the table).
The next full sync replaces the overlay with canonical rows, so its
approximated details (venue city, neutrality) never outlive it. Goal rows for
the freshest matches arrive with that sync too — until then the agent's
`timeline` tool covers a recent match's scorers.

## Tables

| table | one row per | notes |
| ----- | ----------- | ----- |
| `history_matches` | match | `stage` is set for World Cup finals-tournament matches |
| `history_goals` | goal | `scorer`, `minute` (null for a few early-era goals), `own_goal`, `penalty` |
| `history_shootouts` | penalty shootout | `winner`, `first_shooter` |
| `history_team_names` | country rename | current name ↔ the name used between two dates |

Matches are keyed by `(date, home_team, away_team)` — the natural key of the
source data — and goals/shootouts reference their match by the same triple.

## Notes on the data

- Renamed countries appear under their current name for their whole history
  ("Russia" includes the Soviet Union era, "Germany" includes West Germany);
  `history_team_names` maps a date back to the name of the day. Dissolved
  teams keep their own name ("Czechoslovakia", "German DR", "Yugoslavia").
- `stage` uses a small normalized set (`Group stage`, `Round of 32`,
  `Round of 16`, `Quarter-finals`, `Semi-finals`, `Third place`, `Final`);
  a few one-off historical formats stay verbatim — 1950's "Final Round" was a
  round-robin group, not a final, and is stored as such.

## Read-only access for the agent

The `history` agent tool accepts only a single SELECT statement and runs it
inside a `READ ONLY` Postgres transaction — a mutation smuggled into a CTE
fails at the database, not at a regex.

## Example queries

```sql
-- Finals Argentina reached
select count(*) from history_matches
where stage = 'Final' and 'Argentina' in (home_team, away_team);

-- Argentina v England, any competition
select date, home_team, home_score, away_score, away_team, tournament
from history_matches
where 'Argentina' in (home_team, away_team)
  and 'England' in (home_team, away_team)
order by date;

-- Argentina's first-half goals at World Cups
select count(*)
from history_goals g
join history_matches m using (date, home_team, away_team)
where g.team = 'Argentina' and m.tournament = 'FIFA World Cup'
  and g.minute <= 45;
```
