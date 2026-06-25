import {
  knockoutMatches,
  type KnockoutMatch,
  matchByNumber,
  type Round,
} from "@/lib/tournament";

export const roundLabel: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  TP: "Third place",
  FINAL: "Final",
};

/** The two matches that feed match n (home feeder first), if any. */
function childrenOf(n: number): number[] {
  const m = matchByNumber[n];
  if (!m) return [];
  const kids: number[] = [];
  if (m.home.kind === "match") kids.push(m.home.match);
  if (m.away.kind === "match") kids.push(m.away.match);
  return kids;
}

// Vertical ordering key per match, from a DFS over the bracket tree so the two
// feeders of any match sit immediately above/below it — what lists each round
// top-to-bottom in bracket order.
const orderKey: Record<number, number> = {};
{
  let leaf = 0;
  const assign = (n: number): [number, number] => {
    const kids = childrenOf(n);
    if (kids.length === 0) {
      const i = leaf++;
      orderKey[n] = i;
      return [i, i];
    }
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const k of kids) {
      const [a, b] = assign(k);
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
    orderKey[n] = (lo + hi) / 2;
    return [lo, hi];
  };
  assign(101); // left subtree
  assign(102); // right subtree
}

/** All matches of a round in bracket order (top→bottom). */
export function roundMatches(round: Round): KnockoutMatch[] {
  return knockoutMatches
    .filter((m) => m.round === round)
    .sort((a, b) => (orderKey[a.number] ?? 0) - (orderKey[b.number] ?? 0));
}

export const thirdPlaceMatch = matchByNumber[103];
export const finalMatch = matchByNumber[104];
