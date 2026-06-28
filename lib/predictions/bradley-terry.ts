// Bradley-Terry calibration for the knockout bracket: fits 48 team strengths so
// the simulated reach probabilities match the market's reach prices (R16→Final),
// with P(A beats B) = s_A / (s_A + s_B). Optimised with SPSA; the champion market
// is left unfitted as an independent check. The fit averages a few seeded runs in
// log-strength space, so it is deterministic.

import { knockoutMatches, type SlotRef } from "../tournament";

type Dist = Map<string, number>;
export type Strengths = Map<string, number>;

/** `${matchNum}:home` | `${matchNum}:away` → distribution over teams. */
export type R32Slots = Map<string, Dist>;

/** Per-team cumulative reach targets [reach_r16, reach_qf, reach_sf, reach_final]. */
export type ReachObs = Map<string, readonly number[]>;

// P(code beats the opponent distribution). Missing strengths default to 1.
function btWinRate(code: string, oppDist: Dist, s: Strengths): number {
  const sT = s.get(code) ?? 1;
  let p = 0;
  for (const [opp, w] of oppDist) p += (w * sT) / (sT + (s.get(opp) ?? 1));
  return p;
}

function matchWinner(home: Dist, away: Dist, s: Strengths): Dist {
  const out: Dist = new Map();
  for (const [code, pH] of home)
    if (pH > 0) out.set(code, pH * btWinRate(code, away, s));
  for (const [code, pA] of away)
    if (pA > 0)
      out.set(code, (out.get(code) ?? 0) + pA * btWinRate(code, home, s));
  return out;
}

/** Winner distribution to substitute for a knockout match's BT result, keyed by
 *  match number — the market's direct read of a decided matchup (e.g. R32 game
 *  odds). Where present, it replaces the strength-derived winner and feeds the
 *  rest of the bracket. */
export type WinnerOverride = Map<number, Dist>;

/** Propagate strengths through the full knockout bracket (skips the play-off).
 *  `override` pins specific matches to a market-given winner distribution. */
export function simulate(
  r32Slots: R32Slots,
  s: Strengths,
  override?: WinnerOverride,
): Map<number, Dist> {
  const winners = new Map<number, Dist>();
  const source = (ref: SlotRef, n: number, side: "home" | "away") =>
    ref.kind === "match"
      ? (winners.get(ref.match) ?? new Map())
      : (r32Slots.get(`${n}:${side}`) ?? new Map());
  for (const m of knockoutMatches) {
    if (m.round === "TP") continue;
    const pinned = override?.get(m.number);
    winners.set(
      m.number,
      pinned ??
        matchWinner(
          source(m.home, m.number, "home"),
          source(m.away, m.number, "away"),
          s,
        ),
    );
  }
  return winners;
}

// Matches whose winners define each cumulative reach target [r16, qf, sf, final].
// We stop at reach_final — the Final's winner is never fitted. index.ts reuses it.
export const REACH_ROUNDS = (["R32", "R16", "QF", "SF"] as const).map((r) =>
  knockoutMatches.filter((m) => m.round === r),
);

function loss(winners: Map<number, Dist>, obs: ReachObs): number {
  let total = 0;
  for (const [team, observed] of obs)
    for (let r = 0; r < observed.length; r++) {
      const sim = REACH_ROUNDS[r].reduce(
        (a, m) => a + (winners.get(m.number)?.get(team) ?? 0),
        0,
      );
      total += (sim - observed[r]) ** 2;
    }
  return total;
}

// Deterministic PRNG so a seeded fit is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One seeded SPSA fit, optionally warm-started from `init`. Strengths live in log
// space so they stay positive.
function fitOnce(
  r32Slots: R32Slots,
  obs: ReachObs,
  seed: number,
  steps: number,
  init?: Strengths,
  override?: WinnerOverride,
): Strengths {
  const rand = mulberry32(seed);
  const teamList = [...obs.keys()];
  const n = teamList.length;
  const logS = teamList.map((t) => Math.log(init?.get(t) ?? 1));
  const eps = 0.08;
  let lr = 0.15;
  for (let step = 0; step < steps; step++) {
    const delta = teamList.map(() => (rand() > 0.5 ? 1 : -1));
    const sPlus = new Map(
      teamList.map((t, i) => [t, Math.exp(logS[i] + eps * delta[i])]),
    );
    const sMinus = new Map(
      teamList.map((t, i) => [t, Math.exp(logS[i] - eps * delta[i])]),
    );
    const g =
      (loss(simulate(r32Slots, sPlus, override), obs) -
        loss(simulate(r32Slots, sMinus, override), obs)) /
      (2 * eps);
    for (let i = 0; i < n; i++) logS[i] -= lr * g * delta[i];
    lr = 0.15 / (1 + step / 150);
  }
  return new Map(teamList.map((t, i) => [t, Math.exp(logS[i])]));
}

// Stable anchor: average `runs` seeded fits in log space. The expensive part
// (~2 s at 4×400 steps) — cache it across calls.
export function anchorStrengths(
  r32Slots: R32Slots,
  obs: ReachObs,
  override?: WinnerOverride,
  runs = 4,
  steps = 400,
): Strengths {
  const teamList = [...obs.keys()];
  const sumLog = new Map(teamList.map((t) => [t, 0]));
  for (let k = 0; k < runs; k++) {
    const s = fitOnce(
      r32Slots,
      obs,
      1009 + k * 7919,
      steps,
      undefined,
      override,
    );
    for (const t of teamList)
      sumLog.set(t, sumLog.get(t)! + Math.log(s.get(t) ?? 1));
  }
  return new Map(teamList.map((t) => [t, Math.exp(sumLog.get(t)! / runs)]));
}

// Production fit: warm-start 80 SPSA steps from the anchor (passed in `base`, or
// computed here). Deterministic — identical inputs yield identical output.
export function fitStrengths(
  r32Slots: R32Slots,
  obs: ReachObs,
  base?: Strengths,
  override?: WinnerOverride,
): Strengths {
  return fitOnce(
    r32Slots,
    obs,
    1,
    80,
    base ?? anchorStrengths(r32Slots, obs, override),
    override,
  );
}
