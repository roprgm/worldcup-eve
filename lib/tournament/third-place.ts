// FIFA's official allocation of the eight best third-placed teams to the Round
// of 32 (2026 World Cup, regulations Annex C). The static counterpart to the
// `third` slot refs in `index.ts`: which group winners host a third-placed team,
// and — for each of the 495 ways the eight qualifying thirds can be spread across
// the twelve groups — exactly which group's third every winner faces.
//
// Only the *combination of groups* matters, never the third-place ranking order.
// Once you know which eight groups produced a qualifying third, the bracket is
// fully determined; the ranking (points → goal difference → goals for → fair play
// → drawing of lots) only decides which eight groups make the cut, and this table
// does the placement. The allocation is not derivable from a rule: each slot only
// draws from a fixed set of groups (the `groups` lists on the R32 `third` refs in
// `index.ts`), but those constraints leave many valid pairings per combination —
// FIFA picks one, published as a fixed table, so we store it verbatim.

import type { GroupLetter } from "./index";

/** A Round-of-32 match where a group winner faces a best third-placed team. */
export interface ThirdPlaceSlot {
  match: number; // FIFA match number (Round of 32)
  winner: GroupLetter; // the group whose winner hosts the third-placed team
}

// The eight host slots in the column order of FIFA's table: 1A, 1B, 1D, 1E, 1G,
// 1I, 1K, 1L. Each ALLOCATIONS entry lists groups in this same order.
export const thirdPlaceSlots: ThirdPlaceSlot[] = [
  { match: 79, winner: "A" },
  { match: 85, winner: "B" },
  { match: 81, winner: "D" },
  { match: 74, winner: "E" },
  { match: 82, winner: "G" },
  { match: 77, winner: "I" },
  { match: 87, winner: "K" },
  { match: 80, winner: "L" },
];

// The 495 combinations (= C(12, 8)), in FIFA's official "No." order: ALLOCATIONS[n - 1]
// is combination n (see `combinationNumber`). Each string is eight group letters —
// the group whose third-placed team fills each slot, in `thirdPlaceSlots` order.
// The set of eight letters is the combination of groups whose thirds qualified.
// biome-ignore format: keep the 495-row table as a compact grid
const ALLOCATIONS: string[] = [
  "EJIFHGLK", "HGIDJFLK", "EJIDHGLK", "EJIDHFLK", "EGIDJFLK", "EGJDHFLK", "EGIDHFLK", "EGJDHFLI", "EGJDHFIK",
  "HGICJFLK", "EJICHGLK", "EJICHFLK", "EGICJFLK", "EGJCHFLK", "EGICHFLK", "EGJCHFLI", "EGJCHFIK", "HGICJDLK",
  "CJIDHFLK", "CGIDJFLK", "CGJDHFLK", "CGIDHFLK", "CGJDHFLI", "CGJDHFIK", "EJICHDLK", "EGICJDLK", "EGJCHDLK",
  "EGICHDLK", "EGJCHDLI", "EGJCHDIK", "CJEDIFLK", "CJEDHFLK", "CEIDHFLK", "CJEDHFLI", "CJEDHFIK", "CGEDJFLK",
  "CGEDIFLK", "CGEDJFLI", "CGEDJFIK", "CGEDHFLK", "CGJDHFLE", "CGJDHFEK", "CGEDHFLI", "CGEDHFIK", "CGJDHFEI",
  "HJBFIGLK", "EJIBHGLK", "EJBFIHLK", "EJBFIGLK", "EJBFHGLK", "EGBFIHLK", "EJBFHGLI", "EJBFHGIK", "HJBDIGLK",
  "HJBDIFLK", "IGBDJFLK", "HGBDJFLK", "HGBDIFLK", "HGBDJFLI", "HGBDJFIK", "EJBDIHLK", "EJBDIGLK", "EJBDHGLK",
  "EGBDIHLK", "EJBDHGLI", "EJBDHGIK", "EJBDIFLK", "EJBDHFLK", "EIBDHFLK", "EJBDHFLI", "EJBDHFIK", "EGBDJFLK",
  "EGBDIFLK", "EGBDJFLI", "EGBDJFIK", "EGBDHFLK", "HGBDJFLE", "HGBDJFEK", "EGBDHFLI", "EGBDHFIK", "HGBDJFEI",
  "HJBCIGLK", "HJBCIFLK", "IGBCJFLK", "HGBCJFLK", "HGBCIFLK", "HGBCJFLI", "HGBCJFIK", "EJBCIHLK", "EJBCIGLK",
  "EJBCHGLK", "EGBCIHLK", "EJBCHGLI", "EJBCHGIK", "EJBCIFLK", "EJBCHFLK", "EIBCHFLK", "EJBCHFLI", "EJBCHFIK",
  "EGBCJFLK", "EGBCIFLK", "EGBCJFLI", "EGBCJFIK", "EGBCHFLK", "HGBCJFLE", "HGBCJFEK", "EGBCHFLI", "EGBCHFIK",
  "HGBCJFEI", "HJBCIDLK", "IGBCJDLK", "HGBCJDLK", "HGBCIDLK", "HGBCJDLI", "HGBCJDIK", "CJBDIFLK", "CJBDHFLK",
  "CIBDHFLK", "CJBDHFLI", "CJBDHFIK", "CGBDJFLK", "CGBDIFLK", "CGBDJFLI", "CGBDJFIK", "CGBDHFLK", "CGBDHFLJ",
  "HGBCJFDK", "CGBDHFLI", "CGBDHFIK", "HGBCJFDI", "EJBCIDLK", "EJBCHDLK", "EIBCHDLK", "EJBCHDLI", "EJBCHDIK",
  "EGBCJDLK", "EGBCIDLK", "EGBCJDLI", "EGBCJDIK", "EGBCHDLK", "HGBCJDLE", "HGBCJDEK", "EGBCHDLI", "EGBCHDIK",
  "HGBCJDEI", "CJBDEFLK", "CEBDIFLK", "CJBDEFLI", "CJBDEFIK", "CEBDHFLK", "CJBDHFLE", "CJBDHFEK", "CEBDHFLI",
  "CEBDHFIK", "CJBDHFEI", "CGBDEFLK", "CGBDJFLE", "CGBDJFEK", "CGBDEFLI", "CGBDEFIK", "CGBDJFEI", "CGBDHFLE",
  "CGBDHFEK", "HGBCJFDE", "CGBDHFEI", "HJIFAGLK", "EJIAHGLK", "EJIFAHLK", "EJIFAGLK", "EGJFAHLK", "EGIFAHLK",
  "EGJFAHLI", "EGJFAHIK", "HJIDAGLK", "HJIDAFLK", "IGJDAFLK", "HGJDAFLK", "HGIDAFLK", "HGJDAFLI", "HGJDAFIK",
  "EJIDAHLK", "EJIDAGLK", "EGJDAHLK", "EGIDAHLK", "EGJDAHLI", "EGJDAHIK", "EJIDAFLK", "HJEDAFLK", "HEIDAFLK",
  "HJEDAFLI", "HJEDAFIK", "EGJDAFLK", "EGIDAFLK", "EGJDAFLI", "EGJDAFIK", "HGEDAFLK", "HGJDAFLE", "HGJDAFEK",
  "HGEDAFLI", "HGEDAFIK", "HGJDAFEI", "HJICAGLK", "HJICAFLK", "IGJCAFLK", "HGJCAFLK", "HGICAFLK", "HGJCAFLI",
  "HGJCAFIK", "EJICAHLK", "EJICAGLK", "EGJCAHLK", "EGICAHLK", "EGJCAHLI", "EGJCAHIK", "EJICAFLK", "HJECAFLK",
  "HEICAFLK", "HJECAFLI", "HJECAFIK", "EGJCAFLK", "EGICAFLK", "EGJCAFLI", "EGJCAFIK", "HGECAFLK", "HGJCAFLE",
  "HGJCAFEK", "HGECAFLI", "HGECAFIK", "HGJCAFEI", "HJICADLK", "IGJCADLK", "HGJCADLK", "HGICADLK", "HGJCADLI",
  "HGJCADIK", "CJIDAFLK", "HJFCADLK", "HFICADLK", "HJFCADLI", "HJFCADIK", "CGJDAFLK", "CGIDAFLK", "CGJDAFLI",
  "CGJDAFIK", "HGFCADLK", "CGJDAFLH", "HGJCAFDK", "HGFCADLI", "HGFCADIK", "HGJCAFDI", "EJICADLK", "HJECADLK",
  "HEICADLK", "HJECADLI", "HJECADIK", "EGJCADLK", "EGICADLK", "EGJCADLI", "EGJCADIK", "HGECADLK", "HGJCADLE",
  "HGJCADEK", "HGECADLI", "HGECADIK", "HGJCADEI", "CJEDAFLK", "CEIDAFLK", "CJEDAFLI", "CJEDAFIK", "HEFCADLK",
  "HJFCADLE", "HJECAFDK", "HEFCADLI", "HEFCADIK", "HJECAFDI", "CGEDAFLK", "CGJDAFLE", "CGJDAFEK", "CGEDAFLI",
  "CGEDAFIK", "CGJDAFEI", "HGFCADLE", "HGECAFDK", "HGJCAFDE", "HGECAFDI", "HJBAIGLK", "HJBAIFLK", "IJBFAGLK",
  "HJBFAGLK", "HGBAIFLK", "HJBFAGLI", "HJBFAGIK", "EJBAIHLK", "EJBAIGLK", "EJBAHGLK", "EGBAIHLK", "EJBAHGLI",
  "EJBAHGIK", "EJBAIFLK", "EJBFAHLK", "EIBFAHLK", "EJBFAHLI", "EJBFAHIK", "EJBFAGLK", "EGBAIFLK", "EJBFAGLI",
  "EJBFAGIK", "EGBFAHLK", "HJBFAGLE", "HJBFAGEK", "EGBFAHLI", "EGBFAHIK", "HJBFAGEI", "IJBDAHLK", "IJBDAGLK",
  "HJBDAGLK", "IGBDAHLK", "HJBDAGLI", "HJBDAGIK", "IJBDAFLK", "HJBDAFLK", "HIBDAFLK", "HJBDAFLI", "HJBDAFIK",
  "FJBDAGLK", "IGBDAFLK", "FJBDAGLI", "FJBDAGIK", "HGBDAFLK", "HGBDAFLJ", "HGBDAFJK", "HGBDAFLI", "HGBDAFIK",
  "HGBDAFIJ", "EJBAIDLK", "EJBDAHLK", "EIBDAHLK", "EJBDAHLI", "EJBDAHIK", "EJBDAGLK", "EGBAIDLK", "EJBDAGLI",
  "EJBDAGIK", "EGBDAHLK", "HJBDAGLE", "HJBDAGEK", "EGBDAHLI", "EGBDAHIK", "HJBDAGEI", "EJBDAFLK", "EIBDAFLK",
  "EJBDAFLI", "EJBDAFIK", "HEBDAFLK", "HJBDAFLE", "HJBDAFEK", "HEBDAFLI", "HEBDAFIK", "HJBDAFEI", "EGBDAFLK",
  "EGBDAFLJ", "EGBDAFJK", "EGBDAFLI", "EGBDAFIK", "EGBDAFIJ", "HGBDAFLE", "HGBDAFEK", "HGBDAFEJ", "HGBDAFEI",
  "IJBCAHLK", "IJBCAGLK", "HJBCAGLK", "IGBCAHLK", "HJBCAGLI", "HJBCAGIK", "IJBCAFLK", "HJBCAFLK", "HIBCAFLK",
  "HJBCAFLI", "HJBCAFIK", "CJBFAGLK", "IGBCAFLK", "CJBFAGLI", "CJBFAGIK", "HGBCAFLK", "HGBCAFLJ", "HGBCAFJK",
  "HGBCAFLI", "HGBCAFIK", "HGBCAFIJ", "EJBAICLK", "EJBCAHLK", "EIBCAHLK", "EJBCAHLI", "EJBCAHIK", "EJBCAGLK",
  "EGBAICLK", "EJBCAGLI", "EJBCAGIK", "EGBCAHLK", "HJBCAGLE", "HJBCAGEK", "EGBCAHLI", "EGBCAHIK", "HJBCAGEI",
  "EJBCAFLK", "EIBCAFLK", "EJBCAFLI", "EJBCAFIK", "HEBCAFLK", "HJBCAFLE", "HJBCAFEK", "HEBCAFLI", "HEBCAFIK",
  "HJBCAFEI", "EGBCAFLK", "EGBCAFLJ", "EGBCAFJK", "EGBCAFLI", "EGBCAFIK", "EGBCAFIJ", "HGBCAFLE", "HGBCAFEK",
  "HGBCAFEJ", "HGBCAFEI", "IJBCADLK", "HJBCADLK", "HIBCADLK", "HJBCADLI", "HJBCADIK", "CJBDAGLK", "IGBCADLK",
  "CJBDAGLI", "CJBDAGIK", "HGBCADLK", "HGBCADLJ", "HGBCADJK", "HGBCADLI", "HGBCADIK", "HGBCADIJ", "CJBDAFLK",
  "CIBDAFLK", "CJBDAFLI", "CJBDAFIK", "HFBCADLK", "CJBDAFLH", "HJBCAFDK", "HFBCADLI", "HFBCADIK", "HJBCAFDI",
  "CGBDAFLK", "CGBDAFLJ", "CGBDAFJK", "CGBDAFLI", "CGBDAFIK", "CGBDAFIJ", "CGBDAFLH", "HGBCAFDK", "HGBCAFDJ",
  "HGBCAFDI", "EJBCADLK", "EIBCADLK", "EJBCADLI", "EJBCADIK", "HEBCADLK", "HJBCADLE", "HJBCADEK", "HEBCADLI",
  "HEBCADIK", "HJBCADEI", "EGBCADLK", "EGBCADLJ", "EGBCADJK", "EGBCADLI", "EGBCADIK", "EGBCADIJ", "HGBCADLE",
  "HGBCADEK", "HGBCADEJ", "HGBCADEI", "CEBDAFLK", "CJBDAFLE", "CJBDAFEK", "CEBDAFLI", "CEBDAFIK", "CJBDAFEI",
  "HFBCADLE", "HEBCAFDK", "HJBCAFDE", "HEBCAFDI", "CGBDAFLE", "CGBDAFEK", "CGBDAFEJ", "CGBDAFEI", "HGBCAFDE"
];

const GROUP_ORDER = "ABCDEFGHIJKL"; // FIFA's group order; Annex C numbers combinations lexicographically in it.

// FIFA numbers the 495 combinations (Annex C) by the lexicographic rank of the four
// groups whose third did NOT qualify — equivalently, the index of those four groups
// in `itertools.combinations("ABCDEFGHIJKL", 4)`. Enumerating that order here lets us
// reproduce FIFA's "No." exactly (verified against all 495 published rows), so the
// listing above can stay in the same order as the official document.
const combinationNumberByEliminated = (() => {
  const g = GROUP_ORDER;
  const map = new Map<string, number>();
  let n = 0;
  for (let a = 0; a < g.length; a++)
    for (let b = a + 1; b < g.length; b++)
      for (let c = b + 1; c < g.length; c++)
        for (let d = c + 1; d < g.length; d++)
          map.set(g[a] + g[b] + g[c] + g[d], ++n);
  return map;
})();

/**
 * FIFA combination number (1–495) for a set of four groups whose third-placed team
 * did NOT qualify — the "No." column of Annex C. Throws if not four distinct groups.
 */
export function combinationNumber(
  eliminatedGroups: Iterable<GroupLetter>,
): number {
  const key = [...new Set(eliminatedGroups)].sort().join("");
  const n = combinationNumberByEliminated.get(key);
  if (n == null)
    throw new Error(`expected four distinct group letters, got "${key}"`);
  return n;
}

/**
 * Given the eight groups whose third-placed teams qualified, return which group's
 * third fills each Round-of-32 third slot, keyed by FIFA match number. Returns null
 * if the input is not a valid set of eight distinct groups.
 */
export function thirdPlaceAllocation(
  qualifyingGroups: Iterable<GroupLetter>,
): Record<number, GroupLetter> | null {
  const qualifying = new Set(qualifyingGroups);
  const eliminated = [...GROUP_ORDER].filter(
    (g) => !qualifying.has(g as GroupLetter),
  ) as GroupLetter[];
  if (qualifying.size !== 8 || eliminated.length !== 4) return null;
  const alloc = ALLOCATIONS[combinationNumber(eliminated) - 1];
  const out: Record<number, GroupLetter> = {};
  thirdPlaceSlots.forEach((slot, i) => {
    out[slot.match] = alloc[i] as GroupLetter;
  });
  return out;
}

/** Per Round-of-32 third slot, the chance each group's third fills it. Keyed by
 *  match number, then group letter → probability in [0, 1] (a slot's groups sum
 *  to 1). */
export type ThirdSlotOdds = Record<
  number,
  Partial<Record<GroupLetter, number>>
>;

export interface ThirdSlotOddsResult {
  possible: number; // how many of the 495 combinations were counted
  odds: ThirdSlotOdds;
}

/**
 * Third-slot odds under a uniform prior over the combinations `keep` accepts —
 * each kept combination equally likely. `keep` receives one combination's eight
 * qualifying groups; returning false drops it. Counts, per slot, how often each
 * group's third lands there across the kept combinations, then normalizes.
 */
export function thirdSlotOdds(
  keep: (qualifyingGroups: GroupLetter[]) => boolean,
): ThirdSlotOddsResult {
  const counts: ThirdSlotOdds = {};
  for (const slot of thirdPlaceSlots) counts[slot.match] = {};
  let possible = 0;
  for (const alloc of ALLOCATIONS) {
    if (!keep([...alloc] as GroupLetter[])) continue;
    possible++;
    thirdPlaceSlots.forEach((slot, i) => {
      const group = alloc[i] as GroupLetter;
      counts[slot.match][group] = (counts[slot.match][group] ?? 0) + 1;
    });
  }
  for (const slot of thirdPlaceSlots) {
    const bucket = counts[slot.match];
    for (const group of Object.keys(bucket) as GroupLetter[])
      bucket[group] = (bucket[group] ?? 0) / possible;
  }
  return { possible, odds: counts };
}
