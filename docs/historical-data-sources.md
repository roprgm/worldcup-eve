# Historical tournament data sources

Research notes for giving the chat the ability to answer historical questions
("how many times did Argentina reach a final?", "how many times did Argentina
play England?", "how many first-half goals did Argentina score?"). The goal is
an initial sync into our own database; schema design is out of scope here.

Sources are grouped by the level of detail they provide. Detail levels:

- **L1 — Results**: fixture, final score, stage, venue.
- **L2 — Match detail**: goals with scorer + minute, cards, substitutions,
  lineups, penalty shootouts.
- **L3 — Event timeline**: every pass/shot/foul with timestamp and coordinates
  (enables "goals in the first half", xG, etc. — though L2 minute data already
  answers first-half questions).

## Recommended combination

For an initial sync that answers every example question, no payment needed:

1. **martj42/international_results** (L1+partial L2) — every men's
   international ever played (~49k matches since 1872, all tournaments and
   friendlies). Answers head-to-head questions like Argentina vs England
   across all competitions. Includes `goalscorers.csv` with the **minute** of
   each goal, plus `shootouts.csv`.
2. **Fjelstul World Cup Database** (L2) — deep relational data for every
   World Cup 1930–2022. Answers stage questions (finals, semifinals) plus
   goals, bookings, substitutions, squads, awards.
3. **StatsBomb Open Data** (L3, optional) — full event timelines for the
   World Cups it covers, if we later want play-by-play questions.

## Free / open datasets (bulk download, best for initial sync)

### martj42/international_results — CC0-like open data

- <https://github.com/martj42/international_results> (also on
  [Kaggle](https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017))
- ~49,000+ men's full internationals from 1872 to today, updated continuously
  via the repo. World Cups, qualifiers, continental cups, friendlies.
- Files: `results.csv` (date, teams, score, tournament, city, neutral flag),
  `goalscorers.csv` (scorer, **minute**, own goal, penalty),
  `shootouts.csv`.
- No stage column (group/semi/final) — that's the gap Fjelstul fills for
  World Cups.

### Fjelstul World Cup Database — CC-BY 4.0

- <https://github.com/jfjelstul/worldcup>
- All men's World Cups 1930–2022 and women's 1991–2019(+). 27 relational
  datasets, ~1.5M data points: matches **with stage**, teams, players,
  managers, referees, squads, goals (with minute), penalty kicks, bookings,
  substitutions, standings, awards.
- Ships as CSV, JSON, and **ready-made SQLite** — the fastest path to a
  queryable database. Static (not updated live); new tournaments must come
  from another source.

### openfootball (football.db) — CC0 public domain

- <https://github.com/openfootball/worldcup>,
  <https://github.com/openfootball/worldcup.json>,
  <https://github.com/openfootball/worldcup.more>
- All World Cups 1930–2022 plus 2026 fixtures, in plain-text Football.TXT and
  JSON. `worldcup.more` adds goal scorers, lineups, penalty shootouts, send-offs.
- Community-maintained; also has Euro/Copa América repos. Good complement and
  a source for the 2026 schedule.

### StatsBomb Open Data — free with attribution (research/non-commercial terms)

- <https://github.com/statsbomb/open-data> (Python client:
  [statsbombpy](https://github.com/statsbomb/statsbombpy))
- Full **event-level data** (every pass, shot, duel, with minute/second and
  pitch coordinates) as JSON. Covered international tournaments as of now:
  men's World Cups **1958, 1962, 1970, 1974, 1986, 1990, 2018, 2022**;
  women's World Cups 2019, 2023; Euro 2020, 2024; Women's Euro 2022, 2025;
  Copa América 2024; Africa Cup of Nations 2023.
- The only free L3 source. Not every World Cup edition, and the license
  requires attribution and limits commercial use — check `LICENSE.pdf` before
  shipping.

### RSSSF — the canonical historical archive

- <https://www.rsssf.org/> (World Cup archive:
  <https://www.rsssf.org/tablesw/wcf-full-intro.html>, internationals:
  <https://www.rsssf.org/intland.html>)
- Semi-structured text pages maintained by football historians; the primary
  source most datasets above were built from. Partial conversions to
  Football.TXT exist at <https://github.com/rsssf>.
- Use as a verification/reference source rather than a direct sync source
  (parsing is painful).

### Kaggle datasets

- [FIFA World Cup 1930–2026 (piterfm)](https://www.kaggle.com/datasets/piterfm/fifa-football-world-cup),
  [Maven Analytics World Cup CSVs](https://mavenanalytics.io/data-playground/world-cup),
  and mirrors of martj42/Fjelstul. Convenient CSVs, but mostly derivatives of
  the sources above — prefer the upstream repos for freshness.

## Free-tier APIs (better for keeping data current than for backfill)

### TheSportsDB — free key / $9-month premium

- <https://www.thesportsdb.com/> — crowd-sourced; teams, events, scores,
  artwork/badges (useful for UI). Free tier 30 req/min. Community-edited, so
  accuracy on old tournaments is uneven.

### football-data.org — free tier

- <https://www.football-data.org/> — World Cup and Euro included in the free
  tier (10 calls/min), but **historical data is limited to the current
  season** on free. Good for live/upcoming syncing, not backfill.

### Zafronix WC API — free (250 req/day)

- <https://api.zafronix.com/> — World Cup–specific JSON API claiming 1930–2026
  coverage: squads, brackets, attendance, top scorers. Small/unproven project;
  validate before relying on it.

## Paid APIs (current + historical, with SLAs)

### API-Football (api-sports.io) — from ~€19/month

- <https://www.api-football.com/> — 1,200+ competitions; events, lineups,
  player stats. World Cup included in higher tiers (~€49/month international
  plan). Historical depth is roughly the last ~15 years, not 1930.

### Sportmonks — from ~€49/month

- <https://www.sportmonks.com/football-api/world-cup-api/> — World Cup in the
  International plan; historical past editions, livescores, lineups, events.

### TheStatsAPI — from ~$50/month

- <https://www.thestatsapi.com/world-cup> — markets every World Cup match
  1930–2022 via REST: post-1990 editions with lineups/subs/events, 1930–1950
  mostly final scores.

### Opta (Stats Perform) / Sportradar — enterprise

- <https://www.statsperform.com/products/opta-data/>,
  <https://sportradar.com/> — the professional L3 event feeds (what
  broadcasters use), deep historical coverage, licensed per competition.
  Custom quotes only; typically thousands of USD/year. Overkill unless the
  product becomes commercial and needs guaranteed data rights.

## Reference sites (scraping — check terms first)

- **11v11** (<https://www.11v11.com/>) — every international since 1872 with
  head-to-head pages; official AFS historical record. No API.
- **FBref** (<https://fbref.com/en/comps/1/history/World-Cup-Seasons>) —
  advanced stats for modern World Cups; scrapeable via
  [worldfootballR](https://jaseziv.github.io/worldfootballR/) /
  [soccerdata](https://github.com/probberechts/soccerdata), rate-limited, and
  their data usage terms restrict redistribution.
- **FIFA head-to-head** (<https://inside.fifa.com/data-centre/head-to-head>) —
  official numbers, useful to validate our aggregates.
- **eloratings.net** — all-time international Elo ratings if we ever want
  strength-over-time context.

## What each example question needs

| Question | Needs | Covered by |
| --- | --- | --- |
| Times Argentina reached the final / semifinal | stage per match | Fjelstul, openfootball |
| Times Argentina played England | all internationals, not just WC | martj42 |
| Goals per match, scorers | goals with scorer | martj42, Fjelstul, openfootball.more |
| First-half goals | goal **minute** | martj42 `goalscorers.csv`, Fjelstul, StatsBomb |
| Play-by-play (shots, passes, xG) | event data | StatsBomb (free, partial), Opta/Sportradar (paid) |
