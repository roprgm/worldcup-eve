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
} from "./bradley-terry";
import {
  fetchGroupMarkets,
  type MatchOdds,
  type Scoreline,
} from "./group-markets";
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
export interface Predictions {
  updatedAt: string; // ISO timestamp
  catalogGeneratedAt: string;
  slots: PredictedSlot[];
  champion: Candidate[]; // direct champion market
  bracketChampion: Candidate[]; // BT winner of the Final (match 104)
  groups: GroupOdds[];
  reach: TeamReach[];
  /** Most-likely exact scoreline per unplayed group fixture, by fixture id. */
  groupScores: Record<string, Scoreline>;
  /** Live two-way (home/away) win chance per group fixture with a market. */
  matchOdds: MatchOdds[];
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

// Optional cross-call cache for the expensive fit anchor (~2 s). Pass the same
// object across calls to reuse it; the default recomputes it (keeping the call
// pure). Drop/replace the object to invalidate.
export interface PredictionCache {
  anchor?: Strengths;
}

export async function buildPredictions(
  cache: PredictionCache = {},
  // Optional override for the Round-of-32 third-place slots, keyed "match:side"
  // → team distribution. When given (from real results), it replaces the market
  // heuristic for those slots; other slots are untouched.
  thirdSlotDists?: Map<string, Dist>,
): Promise<Predictions> {
  const [prices, groupMarkets] = await Promise.all([
    fetchPrices(),
    fetchGroupMarkets(),
  ]);

  const r32Slots = buildR32Slots(prices);
  const reachObs: ReachObs = new Map(
    teamCodes.map((t) => [t, reachObsFor(prices, t)]),
  );
  cache.anchor ??= anchorStrengths(r32Slots, reachObs);
  const strengths = fitStrengths(r32Slots, reachObs, cache.anchor);
  const winners = simulate(r32Slots, strengths);

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

  // R32 from group markets, R16+ from the BT winner of the feeding match, play-off from the losers.
  const slots: PredictedSlot[] = [];
  for (const m of knockoutMatches)
    for (const side of ["home", "away"] as const) {
      const ref = m[side];
      const key = `${m.number}:${side}`;
      const dist =
        m.round === "R32"
          ? (thirdSlotDists?.get(key) ?? r32Slots.get(key) ?? new Map())
          : ref.kind === "match"
            ? (winners.get(ref.match) ?? new Map())
            : ref.kind === "loser"
              ? losersOf(ref.match)
              : new Map();
      const keepZeros =
        m.round === "R32" && (ref.kind === "winner" || ref.kind === "runner");
      slots.push({
        match: m.number,
        side,
        candidates: toCandidates(normalize(dist), keepZeros),
      });
    }

  const champion = toCandidates(
    normalize(
      new Map(
        teamCodes.map((t) => [t, marketProb(prices, "champion", t) ?? 0]),
      ),
    ),
  );
  const bracketChampion = toCandidates(
    normalize(winners.get(104) ?? new Map()),
  );

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
    slots,
    champion,
    bracketChampion,
    groups,
    reach,
    groupScores: groupMarkets.scores,
    matchOdds: groupMarkets.odds,
  };
}

// Cached snapshot shared by the predictions API route and the agent. The fit is
// the cost (~2s), so we cache the result in the Vercel Runtime Cache
// (cross-instance, with a transparent in-memory fallback elsewhere) and reuse
// the fit anchor across the rare rebuilds.
const PREDICTIONS_TTL = 60; // tune later (KV / longer partial caches) to optimize the BT fit
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

export async function getPredictions(): Promise<Predictions> {
  const hit = await predictionsCache.get("snapshot");
  if (hit != null) return hit as Predictions;
  // Real results sharpen the Round-of-32 third-place slots; fall back to the
  // market heuristic if the results feed is unavailable.
  const thirdSlotDists = await getMatchResults()
    .then(thirdSlotDistsFromResults)
    .catch(() => undefined);
  const data = await buildPredictions(anchor, thirdSlotDists);
  await predictionsCache.set("snapshot", data, {
    ttl: PREDICTIONS_TTL,
    tags: ["predictions"],
  });
  return data;
}

export type { MatchOdds, Scoreline } from "./group-markets";

// Raw market inputs, for showing exactly what we read from the market API.
export { catalog, fetchPrices } from "./market-api";
export type { CatalogMarket } from "./market-api";
