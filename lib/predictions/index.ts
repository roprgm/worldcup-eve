// Entry point: fetch live market prices, fit the Bradley-Terry strengths,
// simulate the bracket, and assemble one JSON snapshot.
//
//   import { getPredictions } from "./predictions"
//   const snapshot = await getPredictions()

import { getCache } from "@vercel/functions";

import { catalog, fetchPrices } from "./market-api";
import {
  groupLetters,
  groupTeams,
  knockoutMatches,
  teamCodes,
} from "../tournament";
import type { GroupLetter, KnockoutMatch, SlotRef } from "../tournament";
import {
  buildR32Slots,
  groupPlace,
  marketProb,
  normalize,
  reachObsFor,
  settle,
  type Dist,
} from "./markets";
import {
  anchorStrengths,
  fitStrengths,
  REACH_ROUNDS,
  simulate,
  type ReachObs,
  type Strengths,
  type WinnerOverride,
} from "./bradley-terry";
import {
  fetchGroupMarkets,
  type MatchOdds,
  type Scoreline,
} from "./group-markets";
import {
  fetchKnockoutMarkets,
  pairKey,
  type KnockoutMarketsSnapshot,
} from "./knockout-markets";
import { readLatestEpoch, writeEpoch, type EpochSnapshot } from "./epoch";
import { getMatchResults, type Results } from "../results";

export interface Candidate {
  code: string;
  probability: number; // 0–1, four decimals; a slot's candidates sum to ~1
}
export interface PredictedSlot {
  match: number; // FIFA match number
  side: "home" | "away";
  candidates: Candidate[]; // sorted high→low
}
export interface GroupTeamOdds {
  code: string;
  first: number; // P(win the group)
  second: number; // P(finish runner-up)
  advance: number; // P(reach the knockouts)
}
export interface GroupOdds {
  letter: GroupLetter;
  teams: GroupTeamOdds[];
}
export interface TeamReach {
  code: string;
  r16: number; // P(reach Round of 16) — BT model
  qf: number; // P(reach Quarter-finals) — BT model
  sf: number; // P(reach Semi-finals) — BT model
  final: number; // P(reach Final) — BT model
  btChampion: number; // P(win the Final) — BT model
  mktChampion: number; // P(champion) — direct market
}
export interface KnockoutOdds {
  match: number; // FIFA match number (73–104)
  home: string; // FIFA code
  away: string;
  homeWin: number; // P(home wins in regulation)
  draw: number | null; // P(draw in regulation), null if unpriced
  awayWin: number; // P(away wins in regulation)
  homeAdvance: number; // P(home advances) — two-way, homeAdvance + awayAdvance = 1
  awayAdvance: number;
}
/** Everything the bracket simulation produces from one Bradley-Terry fit. The
 *  live snapshot exposes these at the top level of `Predictions`; the start-of-
 *  day epoch carries the same shape and is surfaced as `Predictions.baseline`. */
export interface BracketOutputs {
  slots: PredictedSlot[];
  bracketChampion: Candidate[]; // BT winner of the Final (match 104)
  reach: TeamReach[];
  /** Most-likely exact scoreline per decided knockout match with a per-game
   *  market, by FIFA match number (oriented to the bracket's home/away). */
  knockoutScores: Record<number, Scoreline>;
  /** Direct per-game market read for each decided knockout match: the
   *  regulation three-way (home/draw/away) and the two-way advance odds it
   *  implies. The market's own answer — no BT inference. */
  knockoutOdds: KnockoutOdds[];
  /** BT win distribution per knockout match (73–104, excl. the third-place
   *  play-off): the teams that could win it, sorted high→low. For a decided
   *  matchup this is the head-to-head win split. */
  matchWinOdds: Record<number, Candidate[]>;
  /** Fitted Bradley-Terry strength per team (FIFA code). A neutral-site
   *  head-to-head is `s_A / (s_A + s_B)` — the basis for any hypothetical
   *  matchup, even one the bracket hasn't drawn. */
  teamStrengths: Record<string, number>;
}

export interface Predictions extends BracketOutputs {
  updatedAt: string; // ISO timestamp
  catalogGeneratedAt: string;
  champion: Candidate[]; // direct champion market
  groups: GroupOdds[];
  /** Most-likely exact scoreline per unplayed group fixture, by fixture id. */
  groupScores: Record<string, Scoreline>;
  /** Live two-way (home/away) win chance per group fixture with a market. */
  matchOdds: MatchOdds[];
  /** The bracket outputs from the start-of-day epoch (the persisted snapshot),
   *  the before/after counterpart the bars diff against. Equals the live bracket
   *  until the first epoch is captured. */
  baseline: BracketOutputs;
}

// 4 decimals: display-only, keeps the payload small, drops long-tail candidates.
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

// keepZeros lists every team (even at 0%) — for the fixed four-team group slots.
function toCandidates(dist: Dist, keepZeros = false): Candidate[] {
  return [...dist]
    .map(([code, p]) => ({ code, probability: round4(p) }))
    .filter((c) => keepZeros || c.probability > 0)
    .sort((a, b) => b.probability - a.probability);
}

// Fallback cache for the expensive fit anchor (~2 s), used only when no epoch is
// available to warm-start from (first deploy / local dev). Pass the same object
// across calls to reuse it; the default recomputes it. With an epoch present the
// anchor is never computed here.
export interface PredictionCache {
  live?: { anchor?: Strengths };
}

// A slot's team once it is all but certain (group stage decided), else null.
function decidedTeam(dist?: Dist): string | null {
  if (!dist) return null;
  let best: string | null = null;
  let bestP = 0;
  for (const [code, p] of dist)
    if (p > bestP) {
      bestP = p;
      best = code;
    }
  return best != null && bestP >= 0.99 ? best : null;
}

// For every knockout match whose two sides are decided and that Polymarket
// prices as a per-game market, read that market directly: the winner override
// for the simulation (two-way advance), the most-likely scoreline, and the raw
// three-way odds. Matches with an unresolved slot or no market are left to BT.
function knockoutMarketOverride(
  r32Slots: Map<string, Dist>,
  markets: Awaited<ReturnType<typeof fetchKnockoutMarkets>>,
): {
  override: WinnerOverride;
  scores: Record<number, Scoreline>;
  odds: KnockoutOdds[];
} {
  const override: WinnerOverride = new Map();
  const scores: Record<number, Scoreline> = {};
  const odds: KnockoutOdds[] = [];

  for (const m of knockoutMatches) {
    if (m.round !== "R32") continue; // only R32 games are decided & priced for now
    const home = decidedTeam(r32Slots.get(`${m.number}:home`));
    const away = decidedTeam(r32Slots.get(`${m.number}:away`));
    if (!home || !away) continue;
    const market = markets.byPair.get(pairKey(home, away));
    if (!market) continue;

    const homeAdv = market.advance[home];
    const awayAdv = market.advance[away];
    if (homeAdv != null && awayAdv != null)
      override.set(
        m.number,
        new Map([
          [home, homeAdv],
          [away, awayAdv],
        ]),
      );

    if (market.score) {
      // The catalog stores goals as (teams[0]=`a`, teams[1]=`b`); orient to ours.
      const [t0] = market.teams;
      scores[m.number] =
        t0 === home
          ? { h: market.score.a, a: market.score.b }
          : { h: market.score.b, a: market.score.a };
    }

    odds.push({
      match: m.number,
      home,
      away,
      homeWin: round4(market.win[home] ?? 0),
      draw: market.draw == null ? null : round4(market.draw),
      awayWin: round4(market.win[away] ?? 0),
      homeAdvance: round4(homeAdv ?? 0),
      awayAdvance: round4(awayAdv ?? 0),
    });
  }
  return { override, scores, odds };
}

// Fit and simulate the whole bracket from the live knockout markets, returning
// every output that depends on the fit. The futures-derived champion/groups are
// computed by the caller and shared. `prices` is needed only for each team's
// market champion column. `base` warm-starts the fit from the persisted epoch
// (skipping the ~2 s anchor); without it the anchor is computed and cached.
function simulateBracket(
  r32Slots: Map<string, Dist>,
  reachObs: ReachObs,
  knockoutMarkets: KnockoutMarketsSnapshot,
  prices: Map<string, number>,
  cache: { anchor?: Strengths },
  base?: Strengths,
): BracketOutputs {
  // Once an R32 slot is decided, Polymarket prices that exact matchup directly.
  // Pin those matches to the market's two-way advance odds (instead of inferring
  // them from the fit) and capture the market's scoreline + three-way read. The
  // override also feeds the rest of the bracket, so R16→Final start from it.
  const {
    override: r32Override,
    scores: knockoutScores,
    odds: knockoutOdds,
  } = knockoutMarketOverride(r32Slots, knockoutMarkets);

  // Warm-start from the epoch; fall back to the cached anchor when there's none.
  if (!base) cache.anchor ??= anchorStrengths(r32Slots, reachObs, r32Override);
  const strengths = fitStrengths(
    r32Slots,
    reachObs,
    base ?? cache.anchor,
    r32Override,
  );
  const winners = simulate(r32Slots, strengths, r32Override);

  // Third-place play-off: simulate() skips it, so derive its two slots here as
  // the beaten semi-finalists (teams reaching a semi, minus its winners).
  const matchOf = (n: number) => knockoutMatches.find((m) => m.number === n)!;
  const reaches = (n: number): Dist => {
    const m = matchOf(n);
    const feed = (ref: SlotRef) =>
      ref.kind === "match" ? (winners.get(ref.match) ?? new Map()) : new Map();
    const out: Dist = new Map(feed(m.home));
    for (const [c, p] of feed(m.away)) out.set(c, (out.get(c) ?? 0) + p);
    return out;
  };
  const losersOf = (sf: number): Dist => {
    const out: Dist = new Map();
    for (const [c, p] of reaches(sf))
      out.set(c, Math.max(0, p - (winners.get(sf)?.get(c) ?? 0)));
    return out;
  };

  // R32 from group markets, R16+ from the BT winner of the feeding match,
  // play-off from the losers.
  const slotDist = (m: KnockoutMatch, side: "home" | "away"): Dist => {
    if (m.round === "R32")
      return r32Slots.get(`${m.number}:${side}`) ?? new Map();
    const ref = m[side];
    if (ref.kind === "match") return winners.get(ref.match) ?? new Map();
    if (ref.kind === "loser") return losersOf(ref.match);
    return new Map();
  };

  const slots: PredictedSlot[] = [];
  for (const m of knockoutMatches)
    for (const side of ["home", "away"] as const) {
      const ref = m[side];
      const keepZeros =
        m.round === "R32" && (ref.kind === "winner" || ref.kind === "runner");
      slots.push({
        match: m.number,
        side,
        candidates: toCandidates(normalize(slotDist(m, side)), keepZeros),
      });
    }

  const bracketChampion = toCandidates(
    normalize(winners.get(104) ?? new Map()),
  );

  // Per knockout match, the BT distribution over who wins it. simulate() skips
  // the third-place play-off, so it has no entry here.
  const matchWinOdds: Record<number, Candidate[]> = {};
  for (const m of knockoutMatches) {
    const dist = winners.get(m.number);
    if (dist?.size) matchWinOdds[m.number] = toCandidates(normalize(dist));
  }

  // Per-team reach: sum each team's winner probability across a round's matches
  // (REACH_ROUNDS[0]=R32→r16, [1]=R16→qf, [2]=QF→sf, [3]=SF→final).
  const sumReach = (ms: KnockoutMatch[], code: string) =>
    ms.reduce((a, m) => a + (winners.get(m.number)?.get(code) ?? 0), 0);
  const reach: TeamReach[] = teamCodes
    .map((t) => ({
      code: t,
      r16: round4(sumReach(REACH_ROUNDS[0], t)),
      qf: round4(sumReach(REACH_ROUNDS[1], t)),
      sf: round4(sumReach(REACH_ROUNDS[2], t)),
      final: round4(sumReach(REACH_ROUNDS[3], t)),
      btChampion: round4(winners.get(104)?.get(t) ?? 0),
      mktChampion: round4(marketProb(prices, "champion", t) ?? 0),
    }))
    .sort((a, b) => b.final - a.final);

  return {
    slots,
    bracketChampion,
    reach,
    knockoutScores,
    knockoutOdds,
    matchWinOdds,
    teamStrengths: Object.fromEntries(
      teamCodes.map((t) => [t, round4(strengths.get(t) ?? 1)]),
    ),
  };
}

// The bracket slice of a snapshot, for persisting as the epoch.
const bracketOf = (s: Predictions): BracketOutputs => ({
  slots: s.slots,
  bracketChampion: s.bracketChampion,
  reach: s.reach,
  knockoutScores: s.knockoutScores,
  knockoutOdds: s.knockoutOdds,
  matchWinOdds: s.matchWinOdds,
  teamStrengths: s.teamStrengths,
});

export async function buildPredictions(
  cache: PredictionCache = {},
  // Round-of-32 third-place slots from real results, replacing the market
  // heuristic for those slots; keyed "match:side".
  thirdSlotDists?: Map<string, Dist>,
  // The start-of-day epoch: warm-starts the fit and is the before/after baseline.
  epoch?: EpochSnapshot | null,
): Promise<Predictions> {
  const [prices, groupMarkets, knockoutMarkets] = await Promise.all([
    fetchPrices(),
    fetchGroupMarkets(),
    fetchKnockoutMarkets(),
  ]);

  const r32Slots = buildR32Slots(prices);
  // Replace the market's third-place slots with the results-based distribution
  // (when given) before the fit and simulation, so the whole bracket — not just
  // the R32 display — propagates from the sharper thirds. R16+ stay consistent.
  if (thirdSlotDists)
    for (const [key, dist] of thirdSlotDists) r32Slots.set(key, dist);
  const reachObs: ReachObs = new Map(
    teamCodes.map((t) => [t, reachObsFor(prices, t)]),
  );

  cache.live ??= {};
  const base = epoch ? new Map(Object.entries(epoch.teamStrengths)) : undefined;
  const live = simulateBracket(
    r32Slots,
    reachObs,
    knockoutMarkets,
    prices,
    cache.live,
    base,
  );
  // No epoch yet → baseline mirrors live, so deltas are zero and bars stay solid.
  const baseline = epoch ?? live;

  const champion = toCandidates(
    normalize(
      new Map(
        teamCodes.map((t) => [t, marketProb(prices, "champion", t) ?? 0]),
      ),
    ),
  );

  const groups = groupLetters.map((letter) => ({
    letter,
    teams: groupTeams[letter]
      .map((code) => ({
        code,
        first: round4(settle(groupPlace(prices, "first", code, letter))),
        second: round4(settle(groupPlace(prices, "second", code, letter))),
        advance: round4(marketProb(prices, "advance", code) ?? 0),
      }))
      .sort((a, b) => b.advance - a.advance || b.first - a.first),
  }));

  return {
    updatedAt: new Date().toISOString(),
    catalogGeneratedAt: catalog.generatedAt,
    champion,
    groups,
    groupScores: groupMarkets.scores,
    matchOdds: groupMarkets.odds,
    ...live,
    baseline,
  };
}

// Cached snapshot shared by the predictions API route and the agent. We cache
// the result in the Vercel Runtime Cache (cross-instance, with a transparent
// in-memory fallback elsewhere). An eve schedule refreshes it every minute; each
// rebuild warm-starts from the persisted epoch, so the ~2 s anchor fit only runs
// at the daily capture (or once, as a fallback, when no epoch exists yet).
const PREDICTIONS_TTL = 120; // 2 min, longer than the 1-min refresh to survive a late tick
const anchor: PredictionCache = {};
const predictionsCache = getCache({ namespace: "predictions" });

// Real results turn each Round-of-32 third-place slot into a team distribution —
// uniform over the still-reachable FIFA combinations — sharper than the market
// heuristic. Keyed "match:side"; empty slots are skipped so they fall back.
function thirdSlotDistsFromResults(results: Results): Map<string, Dist> {
  const teamByGroup = new Map(
    results.bestThirds.map((t) => [t.group, t.teamId]),
  );
  const dists = new Map<string, Dist>();
  for (const m of knockoutMatches) {
    if (m.round !== "R32") continue;
    for (const side of ["home", "away"] as const) {
      if (m[side].kind !== "third") continue;
      const dist: Dist = new Map();
      for (const [group, p] of Object.entries(
        results.thirdOdds[m.number] ?? {},
      )) {
        const team = teamByGroup.get(group as GroupLetter);
        if (team && p) dist.set(team, p);
      }
      if (dist.size > 0) dists.set(`${m.number}:${side}`, dist);
    }
  }
  return dists;
}

// Real results sharpen the Round-of-32 third-place slots; fall back to the
// market heuristic if the results feed is unavailable.
const currentThirdSlotDists = () =>
  getMatchResults()
    .then(thirdSlotDistsFromResults)
    .catch(() => undefined);

// Rebuild the snapshot and write it to the cache; the schedule calls this every
// minute to keep reads warm. Warm-starts the fit from the persisted epoch.
export async function refreshPredictions(): Promise<Predictions> {
  const [thirdSlotDists, epoch] = await Promise.all([
    currentThirdSlotDists(),
    readLatestEpoch(),
  ]);
  const data = await buildPredictions(anchor, thirdSlotDists, epoch);
  await predictionsCache.set("snapshot", data, {
    ttl: PREDICTIONS_TTL,
    tags: ["predictions"],
  });
  return data;
}

// Authoritative start-of-day fit (fresh anchor, no warm-start), persisted as the
// day's epoch. Runs once a day from the rollover schedule.
export async function captureDailySnapshot(day: string): Promise<void> {
  const thirdSlotDists = await currentThirdSlotDists();
  const snapshot = await buildPredictions({}, thirdSlotDists, null);
  await writeEpoch(day, bracketOf(snapshot));
}

export async function getPredictions(): Promise<Predictions> {
  const hit = await predictionsCache.get("snapshot");
  if (hit != null) return hit as Predictions;
  return refreshPredictions();
}

export type { MatchOdds, Scoreline } from "./group-markets";

// Raw market inputs, for showing exactly what we read from the market API.
export { catalog, fetchPrices } from "./market-api";
export type { CatalogMarket } from "./market-api";
