// Turn market prices into the model's inputs: per-team reach targets and the
// 32 Round-of-32 slot distributions over teams. Reads the catalog by
// (kind, code, group); nothing here fetches.

import { catalog } from "./market-api";
import { groupTeams, knockoutMatches } from "../tournament";
import type { SlotRef } from "../tournament";

export type Dist = Map<string, number>;

const keyOf = (kind: string, code: string, group?: string) =>
  `${kind}:${group ?? ""}:${code}`;
const conditionByKey = new Map(
  catalog.markets.map((m) => [keyOf(m.kind, m.code, m.group), m.conditionId]),
);

/** Snap near-certain prices to 0/1 so settled markets read cleanly. */
export function settle(p: number): number {
  return p > 0.99 ? 1 : p < 0.01 ? 0 : p;
}

/** Yes probability for one market, or null when the catalog/price has none. */
export function marketProb(
  prices: Map<string, number>,
  kind: string,
  code: string,
  group?: string,
): number | null {
  const condition = conditionByKey.get(keyOf(kind, code, group));
  const price = condition == null ? undefined : prices.get(condition);
  return price == null ? null : settle(price);
}

// Average the signals that are present; null when none are.
function blend(...vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

const sub = (a: number | null, b: number | null) =>
  a == null || b == null ? null : a - b;

// Per-team fit targets [reach_r16, reach_qf, reach_sf, reach_final]. Each level
// blends the two independent quotes the market gives — the stage-of-elimination
// partition (elim_*, which sums to ~1) and the standalone reach_* binary — to
// halve their noise. Stops at reach_final so the champion market stays out-of-sample.
export function reachObsFor(
  prices: Map<string, number>,
  code: string,
): readonly number[] {
  const p = (kind: string) => marketProb(prices, kind, code);
  const elimGroups = p("elim_groups"),
    elimR32 = p("elim_r32");
  const elimReachR16 =
    elimGroups != null && elimR32 != null ? 1 - elimGroups - elimR32 : null;
  const elimReachQf = sub(elimReachR16, p("elim_r16"));
  const elimReachSf = sub(elimReachQf, p("elim_qf"));
  const elimFinal = p("elim_final"),
    elimChampion = p("elim_champion");

  const r16 = blend(elimReachR16, p("reach_r16"));
  const qf = blend(elimReachQf, p("reach_qf"));
  const sf = blend(elimReachSf, p("reach_sf"));
  const final = blend(
    sub(elimReachSf, p("elim_sf")),
    elimFinal != null && elimChampion != null ? elimFinal + elimChampion : null,
    p("reach_final"),
  );

  // Coerce to a monotonically non-increasing partition in [0, 1].
  const c16 = Math.min(1, Math.max(0, r16 ?? 0));
  const cQf = Math.min(c16, Math.max(0, qf ?? 0));
  const cSf = Math.min(cQf, Math.max(0, sf ?? 0));
  return [c16, cQf, cSf, Math.min(cSf, Math.max(0, final ?? 0))];
}

// Two-way "Team to Advance" odds for a decided knockout pair, from each side's
// reach-the-next-round future (`reachKind`). Unlike the regulation money line,
// this stays valid when a match is level after 90' and headed to extra time /
// penalties (a regulation draw) — the future prices who goes through, not the
// 90-minute result. Null when neither side is priced.
export function advanceOdds(
  prices: Map<string, number>,
  reachKind: string,
  home: string,
  away: string,
): { home: number; away: number } | null {
  const h = marketProb(prices, reachKind, home) ?? 0;
  const a = marketProb(prices, reachKind, away) ?? 0;
  const total = h + a;
  if (total <= 0) return null;
  return { home: h / total, away: a / total };
}

export function normalize(dist: Dist): Dist {
  const sum = [...dist.values()].reduce((a, b) => a + b, 0);
  return sum <= 0
    ? dist
    : new Map([...dist].map(([code, p]) => [code, p / sum]));
}

// Group placement: winner directly when present, runner-up directly, and
// third-to-qualify as advance − 1st − 2nd.
export function groupPlace(
  prices: Map<string, number>,
  place: "first" | "second" | "third",
  code: string,
  group: string,
): number {
  const advance = marketProb(prices, "advance", code) ?? 0;
  const second = marketProb(prices, "group_second", code, group) ?? 0;
  if (place === "second") return second;
  const first =
    marketProb(prices, "group_winner", code, group) ??
    Math.max(0, advance - second);
  return place === "first" ? first : Math.max(0, advance - first - second);
}

// How many R32 third-place slots list each group, to share a team's
// third-to-qualify probability across the slots it might land in.
const thirdShareByGroup = (() => {
  const count = new Map<string, number>();
  for (const m of knockoutMatches)
    for (const ref of [m.home, m.away])
      if (ref.kind === "third")
        for (const g of ref.groups) count.set(g, (count.get(g) ?? 0) + 1);
  return count;
})();

function groupSlot(prices: Map<string, number>, ref: SlotRef): Dist {
  if (ref.kind === "third") {
    const dist: Dist = new Map();
    for (const g of ref.groups) {
      const share = thirdShareByGroup.get(g) ?? 1;
      for (const code of groupTeams[g])
        dist.set(code, groupPlace(prices, "third", code, g) / share);
    }
    return normalize(dist);
  }
  if (ref.kind !== "winner" && ref.kind !== "runner")
    throw new Error(`unexpected R32 ref: ${ref.kind}`);
  const { group } = ref;
  const place = ref.kind === "winner" ? "first" : "second";
  const raw = new Map(
    groupTeams[group].map((code) => [
      code,
      groupPlace(prices, place, code, group),
    ]),
  );
  // Independent markets don't enforce group consistency: if arithmetic gives a
  // team ≥1, snap it to certainty rather than let normalize dilute it.
  for (const [code, prob] of raw)
    if (prob >= 1)
      return new Map(groupTeams[group].map((c) => [c, c === code ? 1 : 0]));
  return normalize(raw);
}

/** The 32 R32 slot distributions from group markets — the simulation's starting point. */
export function buildR32Slots(prices: Map<string, number>): Map<string, Dist> {
  const slots = new Map<string, Dist>();
  for (const m of knockoutMatches)
    if (m.round === "R32")
      for (const side of ["home", "away"] as const)
        slots.set(`${m.number}:${side}`, groupSlot(prices, m[side]));
  return slots;
}
