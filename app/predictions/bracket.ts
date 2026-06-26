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

/** All matches of a round in bracket order (top→bottom). */
export function roundMatches(round: Round): KnockoutMatch[] {
  return knockoutMatches
    .filter((m) => m.round === round)
    .sort((a, b) => a.number - b.number);
}

export const thirdPlaceMatch = matchByNumber[103];
export const finalMatch = matchByNumber[104];
