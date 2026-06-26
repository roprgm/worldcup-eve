# results

Everything we read live from ESPN's FIFA World Cup feed — the mirror image of the
`predictions`: what *happened*, not what the market expects. This is the single
place the app and the agent reach ESPN; nothing else queries it.

Three readers, one source (ESPN), no dependencies beyond the global `fetch` and
the `tournament` module (for fixtures and standings rules):

- `buildResults()` — the whole scoreboard: live/final scores, status, kickoff
  times, and the pieces the app overlays on predictions.
- `buildMatchDetail(matchNumber, includeStats?)` — one match's incident timeline
  (goals, cards) and, optionally, team stats.
- `fetchStandings()` — the live group tables (points, goal difference, clinched
  knockout spots).

## Usage

```ts
import { buildResults } from "./results"
import { buildMatchDetail } from "./results/match-detail"
import { fetchStandings } from "./results/standings"

const results = await buildResults()
// → { updatedAt, matches, groupScores, groupStatus, knockoutPicks,
//     knockoutStatus, settledGroupOrder, bestThirds, thirdSlots }

const detail = await buildMatchDetail(29, true) // match 29, with team stats
const standings = await fetchStandings()
```

The web and the agent read these at whatever cadence they like — faster while a
match is live.

## What it returns

| field | what |
| ----- | ---- |
| `matches` | every match (1–104): `status`, `detail`, `kickoff`, `home`/`away` `{code, name, score, winner}` |
| `groupScores` | real scoreline per started group fixture, by id (`"A1"`..) |
| `groupStatus` | `"live"` / `"final"` per started group fixture |
| `knockoutPicks` | winner side (`"home"`/`"away"`) of completed knockout matches |
| `knockoutStatus` | `"live"` / `"final"` per started knockout match |
| `settledGroupOrder` | final 1st–4th order of groups that are fully played, so the bracket can show real qualifiers instead of market favourites |
| `bestThirds` | the twelve third-placed teams ranked as things stand (points → GD → GF); the best eight `qualify`. Provisional while any group is unfinished |
| `thirdSlots` | the eight Round-of-32 third-place matchups those qualifiers imply, via FIFA's allocation table (`tournament`'s `assignThirds`) |
| `thirdOdds` | per third slot, each group's chance of filling it — uniform over the FIFA combinations still mathematically reachable from the results so far (`possibleThirdSlotOdds`) |
| `thirdCombosPossible` | how many of the 495 third-place combinations remain reachable |

## How it works

`buildResults()` fetches the ESPN scoreboard once, maps each event to its FIFA
match number (the static `EVENT_IDS` table), and normalizes scores/status. Group
fixtures are matched to ESPN by the unordered pair of team ids (ESPN
abbreviations equal our FIFA codes) and re-oriented to our fixture's home/away.
A group whose six fixtures are all final gets a `settledGroupOrder` via
`tournament`'s `computeStandings`.

Reaching ESPN needs outbound access to `site.api.espn.com`. In a sandbox that
blocks it, `buildResults()` throws — wrap the call if you want a soft failure.
