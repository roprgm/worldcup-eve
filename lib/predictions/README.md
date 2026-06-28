# predictions

Everything we forecast from Polymarket markets for the 2026 World Cup: the
knockout bracket (who reaches each match, the champion), per-group standings
odds, and per-group-fixture predictions (most-likely exact scoreline and two-way
win odds). One JSON snapshot — the data that feeds a UI, with no UI of its own.

The runtime needs the global `fetch`, `node:fs` (to read the bundled catalogs),
the sibling [`tournament`](../tournament) module (static bracket facts), and one
small dependency — [`bottleneck`](https://www.npmjs.com/package/bottleneck) — to
keep Polymarket requests under the API's rate limits. No framework, no hidden
state.

## Usage

```ts
import { buildPredictions } from "./predictions"

const snapshot = await buildPredictions()
// → { updatedAt, slots, champion, bracketChampion, groups, reach, ... }
```

As a script:

```sh
bun run lib/predictions/cli.ts          # pretty-printed JSON
bun run lib/predictions/cli.ts --min    # one line, for piping into an API
```

Each call fetches fresh prices and refits the model. The fit is deterministic:
identical prices always yield identical output.

### Reusing the fit anchor (optional)

The bulk of the compute is the model's *anchor* — an averaged, stable fit that
takes ~2 s but barely moves between price refreshes. `buildPredictions` recomputes
it every call by default (staying pure and stateless). A long-lived server can
reuse it by passing the same cache object across calls, paying only the ~100 ms
warm-start each time:

```ts
const cache = {}                 // hold this across requests
await buildPredictions(cache)    // first call computes the anchor (~2 s)
await buildPredictions(cache)    // later calls reuse it (~100 ms + fetch)
// drop or replace `cache` to invalidate — e.g. every few minutes
```

This is a deliberately minimal hook; wire it to your platform's real cache
(Redis, Vercel Runtime Cache, …) however you like.

## What it returns

| field             | meaning                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `updatedAt`       | ISO timestamp of this snapshot                                         |
| `slots`           | every knockout slot (matches 73–104, home/away) as a team distribution |
| `champion`        | the direct Polymarket champion market, normalized                      |
| `bracketChampion` | BT-model winner of the Final — pairwise, no 50/50 assumption           |
| `groups`          | per-group odds: P(win group), P(runner-up), P(advance)                 |
| `reach`           | per-team P(reach R16 / QF / SF / Final), plus the market champion price |
| `groupScores`     | most-likely exact scoreline per unplayed group fixture, by id (`"A1"`..) |
| `matchOdds`       | two-way home/away win chance per group fixture with a priced market    |
| `knockoutScores`  | most-likely exact scoreline per decided knockout match with a per-game market, by match number |
| `knockoutOdds`    | the per-game market's direct read of each decided knockout match: regulation three-way (home/draw/away) + the two-way advance odds it implies |
| `matchWinOdds`    | win distribution per knockout match (73–104). R32 comes straight from the per-game market; deeper rounds are the BT model |

Teams are FIFA 3-letter codes (`BRA`, `ARG`, …). Probabilities are in `[0, 1]`,
rounded to four decimals.

## How it works

```text
fetch markets         market-api.ts       live Yes prices (CLOB midpoints + Gamma fallback)
  → reach + R32       markets.ts          prices → reach targets and group-slot distributions
fetch knockout games  knockout-markets.ts exact-score (argmax) + three-way/advance per decided KO match
  → fit + simulate    bradley-terry.ts    SPSA fit of 48 strengths; decided R32 matches pinned to the market
fetch group markets   group-markets.ts    exact-score (argmax) + moneyline (two-way) per group fixture
  → assemble          index.ts            everything above → one JSON snapshot
```

The model fits 48 latent team strengths so the simulated reach probabilities
(R16 → Final) match Polymarket's `reach_*` / `elim_*` markets, where
`P(A beats B) = s_A / (s_A + s_B)`. The outright **champion** market is
deliberately *not* fitted, so it stays an independent comparison against the
model's `bracketChampion`. The third-place play-off (match 103) is filled from
the simulation's beaten semi-finalists. Group fixtures get their predictions
straight from the per-match markets (`group-markets.ts`).

**Decided knockout matches aren't inferred.** Once a Round-of-32 slot is
settled, Polymarket prices that exact matchup directly (a per-game three-way
plus an exact-score market). For those matches we skip the BT pairwise estimate
and pin the winner to the market's two-way **advance** odds (the regulation
win-odds renormalised, which splits the draw in proportion to each side's win
chance). That override feeds the rest of the bracket too, so the R16 → Final
inference starts from the market's real R32 result instead of the fit's guess.
As deeper rounds get decided and priced, the same path covers them.

## Files

| file               | role                                                            |
| ------------------ | --------------------------------------------------------------- |
| `index.ts`         | `buildPredictions()` + the output types — the entry point       |
| `markets.ts`       | futures prices → reach targets and group-slot distributions     |
| `bradley-terry.ts` | the BT model: SPSA fit + bracket simulation (with winner overrides) |
| `group-markets.ts` | per-group-fixture exact scoreline + two-way win odds            |
| `knockout-markets.ts` | per-knockout-match exact scoreline + three-way / advance odds |
| `market-api.ts`    | fetch live prices (rate-limited CLOB + Gamma)                   |
| `markets.json`     | futures catalog (advance / reach / elim / champion token ids)   |
| `group-markets.json` | per-group-fixture catalog (exact-score + moneyline token ids) |
| `knockout-markets.json` | per-knockout-match catalog (exact-score + three-way token ids) |
| `cli.ts`           | print a snapshot as JSON                                        |
| `sync.ts`          | regenerate `markets.json` (build-time tool)                     |

Static bracket facts (teams, groups, knockout graph) come from the sibling
[`tournament`](../tournament) module.

## Where the data comes from: open vs. settled

A Polymarket market is either **open** (price moves every second) or **settled**
(resolved, price fixed at 0 or 1 forever). The two are handled differently:

- **Open markets** — fetched live on every `buildPredictions()` call (CLOB
  midpoints). Never stored.
- **Settled markets** — their final 0/1 price is **baked into `markets.json` by
  `sync`** (the `settled` field). The runtime reads it straight from the catalog
  and never queries those markets again — a settled price can't change.

So the catalog is both *which* markets to read and *the immutable prices we
already know*. As the tournament progresses each re-sync moves more markets into
the settled set, so the live CLOB batch keeps shrinking.

**The gap between syncs:** a market that resolves *after* the last sync is still
marked open in the catalog, so the CLOB has no midpoint for it. Those few fall
through to the Gamma fallback, which returns their settled price for that run —
until the next `sync` bakes it in. So nothing is ever missing; re-syncing just
moves work from the runtime fallback into the static file.

```sh
bun run lib/predictions/sync.ts   # rewrites markets.json + group-markets.json + knockout-markets.json
```

`sync` discovers markets from Polymarket's Gamma API (open *and* closed events,
so settled prices get baked), maps team labels to FIFA codes via the `tournament`
module, and refreshes all three catalogs. Run it periodically (e.g. daily, or
after a matchday) and commit the result. `group-markets.json` and
`knockout-markets.json` hold only still-unplayed fixtures — once a match is
played its result comes from the `results` module, not a forecast.

## Notes

- Reaching Polymarket needs outbound access to `clob.polymarket.com` and
  `gamma-api.polymarket.com`. In a sandbox that blocks them, prices come back
  empty and every probability is `0`.
