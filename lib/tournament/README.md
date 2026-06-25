# tournament

The static facts of the 2026 World Cup — teams, groups, fixtures, the knockout
bracket — and the rules to turn scorelines into a group table. **It queries
nothing.** This is the single source of truth the `predictions` and `results`
modules build on, and what the UI joins its codes against for names and schedule.

Plain TypeScript, no dependencies.

## Usage

```ts
import { teams, groupTeams, knockoutMatches, teamById } from "./tournament"
import { computeStandings, computeGroupOrder } from "./tournament/standings"

teamById["BRA"].name              // "Brazil"
groupTeams.H                      // ["ESP", "CPV", "KSA", "URU"]
computeStandings("H", scores)     // group table, best-first
```

## What it exports

`index.ts` — the data:

| export | what |
| ------ | ---- |
| `teams` / `teamById` / `teamCodes` | the 48 teams (FIFA code, name, group) |
| `groupLetters` / `groupTeams` | the 12 groups and their team codes |
| `groupMatches` | the 72 round-robin fixtures (`A1`..`L6`) |
| `knockoutMatches` / `matchByNumber` | bracket graph (matches 73–104) with round, slot refs, `feedsInto`, date, venue |
| types | `Team`, `GroupMatch`, `KnockoutMatch`, `SlotRef`, `GroupLetter`, `Round` |

`standings.ts` — the rules:

| export | what |
| ------ | ---- |
| `computeStandings(letter, scores)` | one group's table; tiebreak points → GD → goals → seed |
| `computeGroupOrder(scores)` | every group's 1st–4th order |

The scorelines fed to `computeStandings` can be predicted (from `predictions`) or
real (from `results`) — this module doesn't care which.
