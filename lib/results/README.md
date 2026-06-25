# results

Actual match results from ESPN's FIFA World Cup feed — the mirror image of the
`predictions`: it reports what *happened*, not what the market expects. Live and
final scores, status, kickoff times, and the derived pieces the app overlays on
its predictions.

One source (ESPN), one request per refresh, no dependencies beyond the global
`fetch`. Builds on the `tournament` module for fixtures and standings rules.

## Usage

```ts
import { buildResults } from "./results"

const results = await buildResults()
// → { updatedAt, matches, groupScores, groupStatus,
//     knockoutPicks, knockoutStatus, settledGroupOrder }
```

The web polls this at whatever cadence it likes (e.g. every 10 s, faster while a
match is live).

## What it returns

| field | what |
| ----- | ---- |
| `matches` | every match (1–104): `status`, `detail`, `kickoff`, `home`/`away` `{code, name, score, winner}` |
| `groupScores` | real scoreline per started group fixture, by id (`"A1"`..) |
| `groupStatus` | `"live"` / `"final"` per started group fixture |
| `knockoutPicks` | winner side (`"home"`/`"away"`) of completed knockout matches |
| `knockoutStatus` | `"live"` / `"final"` per started knockout match |
| `settledGroupOrder` | final 1st–4th order of groups that are fully played, so the bracket can show real qualifiers instead of market favourites |

## How it works

`buildResults()` fetches the ESPN scoreboard once, maps each event to its FIFA
match number (the static `EVENT_IDS` table), and normalizes scores/status. Group
fixtures are matched to ESPN by the unordered pair of team ids (ESPN
abbreviations equal our FIFA codes) and re-oriented to our fixture's home/away.
A group whose six fixtures are all final gets a `settledGroupOrder` via
`tournament`'s `computeStandings`.

Reaching ESPN needs outbound access to `site.api.espn.com`. In a sandbox that
blocks it, `buildResults()` throws — wrap the call if you want a soft failure.
