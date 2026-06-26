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
// does the placement. Every row keeps two FIFA invariants: a winner never faces a
// third from its own group, and each slot only draws from a fixed set of groups
// (the `groups` lists on the R32 `third` slot refs in `index.ts`).

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

// The 495 combinations (= C(12, 8)). Each string is eight group letters: the
// group whose third-placed team fills each slot, in `thirdPlaceSlots` order. The
// set of eight letters is the combination of groups whose thirds qualified; their
// order is the allocation. Listed sorted by that group set, for stable diffs.
// prettier-ignore
const ALLOCATIONS: string[] = [
  "HGBCAFDE", "CGBDAFEI", "CGBDAFEJ", "CGBDAFEK", "CGBDAFLE", "HEBCAFDI", "HJBCAFDE", "HEBCAFDK", "HFBCADLE",
  "CJBDAFEI", "CEBDAFIK", "CEBDAFLI", "CJBDAFEK", "CJBDAFLE", "CEBDAFLK", "HGBCADEI", "HGBCADEJ", "HGBCADEK",
  "HGBCADLE", "EGBCADIJ", "EGBCADIK", "EGBCADLI", "EGBCADJK", "EGBCADLJ", "EGBCADLK", "HJBCADEI", "HEBCADIK",
  "HEBCADLI", "HJBCADEK", "HJBCADLE", "HEBCADLK", "EJBCADIK", "EJBCADLI", "EIBCADLK", "EJBCADLK", "HGBCAFDI",
  "HGBCAFDJ", "HGBCAFDK", "CGBDAFLH", "CGBDAFIJ", "CGBDAFIK", "CGBDAFLI", "CGBDAFJK", "CGBDAFLJ", "CGBDAFLK",
  "HJBCAFDI", "HFBCADIK", "HFBCADLI", "HJBCAFDK", "CJBDAFLH", "HFBCADLK", "CJBDAFIK", "CJBDAFLI", "CIBDAFLK",
  "CJBDAFLK", "HGBCADIJ", "HGBCADIK", "HGBCADLI", "HGBCADJK", "HGBCADLJ", "HGBCADLK", "CJBDAGIK", "CJBDAGLI",
  "IGBCADLK", "CJBDAGLK", "HJBCADIK", "HJBCADLI", "HIBCADLK", "HJBCADLK", "IJBCADLK", "HGBCAFEI", "HGBCAFEJ",
  "HGBCAFEK", "HGBCAFLE", "EGBCAFIJ", "EGBCAFIK", "EGBCAFLI", "EGBCAFJK", "EGBCAFLJ", "EGBCAFLK", "HJBCAFEI",
  "HEBCAFIK", "HEBCAFLI", "HJBCAFEK", "HJBCAFLE", "HEBCAFLK", "EJBCAFIK", "EJBCAFLI", "EIBCAFLK", "EJBCAFLK",
  "HJBCAGEI", "EGBCAHIK", "EGBCAHLI", "HJBCAGEK", "HJBCAGLE", "EGBCAHLK", "EJBCAGIK", "EJBCAGLI", "EGBAICLK",
  "EJBCAGLK", "EJBCAHIK", "EJBCAHLI", "EIBCAHLK", "EJBCAHLK", "EJBAICLK", "HGBCAFIJ", "HGBCAFIK", "HGBCAFLI",
  "HGBCAFJK", "HGBCAFLJ", "HGBCAFLK", "CJBFAGIK", "CJBFAGLI", "IGBCAFLK", "CJBFAGLK", "HJBCAFIK", "HJBCAFLI",
  "HIBCAFLK", "HJBCAFLK", "IJBCAFLK", "HJBCAGIK", "HJBCAGLI", "IGBCAHLK", "HJBCAGLK", "IJBCAGLK", "IJBCAHLK",
  "HGBDAFEI", "HGBDAFEJ", "HGBDAFEK", "HGBDAFLE", "EGBDAFIJ", "EGBDAFIK", "EGBDAFLI", "EGBDAFJK", "EGBDAFLJ",
  "EGBDAFLK", "HJBDAFEI", "HEBDAFIK", "HEBDAFLI", "HJBDAFEK", "HJBDAFLE", "HEBDAFLK", "EJBDAFIK", "EJBDAFLI",
  "EIBDAFLK", "EJBDAFLK", "HJBDAGEI", "EGBDAHIK", "EGBDAHLI", "HJBDAGEK", "HJBDAGLE", "EGBDAHLK", "EJBDAGIK",
  "EJBDAGLI", "EGBAIDLK", "EJBDAGLK", "EJBDAHIK", "EJBDAHLI", "EIBDAHLK", "EJBDAHLK", "EJBAIDLK", "HGBDAFIJ",
  "HGBDAFIK", "HGBDAFLI", "HGBDAFJK", "HGBDAFLJ", "HGBDAFLK", "FJBDAGIK", "FJBDAGLI", "IGBDAFLK", "FJBDAGLK",
  "HJBDAFIK", "HJBDAFLI", "HIBDAFLK", "HJBDAFLK", "IJBDAFLK", "HJBDAGIK", "HJBDAGLI", "IGBDAHLK", "HJBDAGLK",
  "IJBDAGLK", "IJBDAHLK", "HJBFAGEI", "EGBFAHIK", "EGBFAHLI", "HJBFAGEK", "HJBFAGLE", "EGBFAHLK", "EJBFAGIK",
  "EJBFAGLI", "EGBAIFLK", "EJBFAGLK", "EJBFAHIK", "EJBFAHLI", "EIBFAHLK", "EJBFAHLK", "EJBAIFLK", "EJBAHGIK",
  "EJBAHGLI", "EGBAIHLK", "EJBAHGLK", "EJBAIGLK", "EJBAIHLK", "HJBFAGIK", "HJBFAGLI", "HGBAIFLK", "HJBFAGLK",
  "IJBFAGLK", "HJBAIFLK", "HJBAIGLK", "HGECAFDI", "HGJCAFDE", "HGECAFDK", "HGFCADLE", "CGJDAFEI", "CGEDAFIK",
  "CGEDAFLI", "CGJDAFEK", "CGJDAFLE", "CGEDAFLK", "HJECAFDI", "HEFCADIK", "HEFCADLI", "HJECAFDK", "HJFCADLE",
  "HEFCADLK", "CJEDAFIK", "CJEDAFLI", "CEIDAFLK", "CJEDAFLK", "HGJCADEI", "HGECADIK", "HGECADLI", "HGJCADEK",
  "HGJCADLE", "HGECADLK", "EGJCADIK", "EGJCADLI", "EGICADLK", "EGJCADLK", "HJECADIK", "HJECADLI", "HEICADLK",
  "HJECADLK", "EJICADLK", "HGJCAFDI", "HGFCADIK", "HGFCADLI", "HGJCAFDK", "CGJDAFLH", "HGFCADLK", "CGJDAFIK",
  "CGJDAFLI", "CGIDAFLK", "CGJDAFLK", "HJFCADIK", "HJFCADLI", "HFICADLK", "HJFCADLK", "CJIDAFLK", "HGJCADIK",
  "HGJCADLI", "HGICADLK", "HGJCADLK", "IGJCADLK", "HJICADLK", "HGJCAFEI", "HGECAFIK", "HGECAFLI", "HGJCAFEK",
  "HGJCAFLE", "HGECAFLK", "EGJCAFIK", "EGJCAFLI", "EGICAFLK", "EGJCAFLK", "HJECAFIK", "HJECAFLI", "HEICAFLK",
  "HJECAFLK", "EJICAFLK", "EGJCAHIK", "EGJCAHLI", "EGICAHLK", "EGJCAHLK", "EJICAGLK", "EJICAHLK", "HGJCAFIK",
  "HGJCAFLI", "HGICAFLK", "HGJCAFLK", "IGJCAFLK", "HJICAFLK", "HJICAGLK", "HGJDAFEI", "HGEDAFIK", "HGEDAFLI",
  "HGJDAFEK", "HGJDAFLE", "HGEDAFLK", "EGJDAFIK", "EGJDAFLI", "EGIDAFLK", "EGJDAFLK", "HJEDAFIK", "HJEDAFLI",
  "HEIDAFLK", "HJEDAFLK", "EJIDAFLK", "EGJDAHIK", "EGJDAHLI", "EGIDAHLK", "EGJDAHLK", "EJIDAGLK", "EJIDAHLK",
  "HGJDAFIK", "HGJDAFLI", "HGIDAFLK", "HGJDAFLK", "IGJDAFLK", "HJIDAFLK", "HJIDAGLK", "EGJFAHIK", "EGJFAHLI",
  "EGIFAHLK", "EGJFAHLK", "EJIFAGLK", "EJIFAHLK", "EJIAHGLK", "HJIFAGLK", "CGBDHFEI", "HGBCJFDE", "CGBDHFEK",
  "CGBDHFLE", "CGBDJFEI", "CGBDEFIK", "CGBDEFLI", "CGBDJFEK", "CGBDJFLE", "CGBDEFLK", "CJBDHFEI", "CEBDHFIK",
  "CEBDHFLI", "CJBDHFEK", "CJBDHFLE", "CEBDHFLK", "CJBDEFIK", "CJBDEFLI", "CEBDIFLK", "CJBDEFLK", "HGBCJDEI",
  "EGBCHDIK", "EGBCHDLI", "HGBCJDEK", "HGBCJDLE", "EGBCHDLK", "EGBCJDIK", "EGBCJDLI", "EGBCIDLK", "EGBCJDLK",
  "EJBCHDIK", "EJBCHDLI", "EIBCHDLK", "EJBCHDLK", "EJBCIDLK", "HGBCJFDI", "CGBDHFIK", "CGBDHFLI", "HGBCJFDK",
  "CGBDHFLJ", "CGBDHFLK", "CGBDJFIK", "CGBDJFLI", "CGBDIFLK", "CGBDJFLK", "CJBDHFIK", "CJBDHFLI", "CIBDHFLK",
  "CJBDHFLK", "CJBDIFLK", "HGBCJDIK", "HGBCJDLI", "HGBCIDLK", "HGBCJDLK", "IGBCJDLK", "HJBCIDLK", "HGBCJFEI",
  "EGBCHFIK", "EGBCHFLI", "HGBCJFEK", "HGBCJFLE", "EGBCHFLK", "EGBCJFIK", "EGBCJFLI", "EGBCIFLK", "EGBCJFLK",
  "EJBCHFIK", "EJBCHFLI", "EIBCHFLK", "EJBCHFLK", "EJBCIFLK", "EJBCHGIK", "EJBCHGLI", "EGBCIHLK", "EJBCHGLK",
  "EJBCIGLK", "EJBCIHLK", "HGBCJFIK", "HGBCJFLI", "HGBCIFLK", "HGBCJFLK", "IGBCJFLK", "HJBCIFLK", "HJBCIGLK",
  "HGBDJFEI", "EGBDHFIK", "EGBDHFLI", "HGBDJFEK", "HGBDJFLE", "EGBDHFLK", "EGBDJFIK", "EGBDJFLI", "EGBDIFLK",
  "EGBDJFLK", "EJBDHFIK", "EJBDHFLI", "EIBDHFLK", "EJBDHFLK", "EJBDIFLK", "EJBDHGIK", "EJBDHGLI", "EGBDIHLK",
  "EJBDHGLK", "EJBDIGLK", "EJBDIHLK", "HGBDJFIK", "HGBDJFLI", "HGBDIFLK", "HGBDJFLK", "IGBDJFLK", "HJBDIFLK",
  "HJBDIGLK", "EJBFHGIK", "EJBFHGLI", "EGBFIHLK", "EJBFHGLK", "EJBFIGLK", "EJBFIHLK", "EJIBHGLK", "HJBFIGLK",
  "CGJDHFEI", "CGEDHFIK", "CGEDHFLI", "CGJDHFEK", "CGJDHFLE", "CGEDHFLK", "CGEDJFIK", "CGEDJFLI", "CGEDIFLK",
  "CGEDJFLK", "CJEDHFIK", "CJEDHFLI", "CEIDHFLK", "CJEDHFLK", "CJEDIFLK", "EGJCHDIK", "EGJCHDLI", "EGICHDLK",
  "EGJCHDLK", "EGICJDLK", "EJICHDLK", "CGJDHFIK", "CGJDHFLI", "CGIDHFLK", "CGJDHFLK", "CGIDJFLK", "CJIDHFLK",
  "HGICJDLK", "EGJCHFIK", "EGJCHFLI", "EGICHFLK", "EGJCHFLK", "EGICJFLK", "EJICHFLK", "EJICHGLK", "HGICJFLK",
  "EGJDHFIK", "EGJDHFLI", "EGIDHFLK", "EGJDHFLK", "EGIDJFLK", "EJIDHFLK", "EJIDHGLK", "HGIDJFLK", "EJIFHGLK",
];

// Combination of eight qualifying groups (sorted letters) → allocation string.
const allocationByGroups = new Map(
  ALLOCATIONS.map((a) => [[...a].sort().join(""), a] as const),
);

/**
 * Given the eight groups whose third-placed teams qualified, return which group's
 * third fills each Round-of-32 third slot, keyed by FIFA match number. Returns
 * null if the input is not a valid set of eight distinct groups.
 */
export function thirdPlaceAllocation(
  qualifyingGroups: Iterable<GroupLetter>,
): Record<number, GroupLetter> | null {
  const key = [...qualifyingGroups].sort().join("");
  const alloc = allocationByGroups.get(key);
  if (!alloc) return null;
  const out: Record<number, GroupLetter> = {};
  thirdPlaceSlots.forEach((slot, i) => {
    out[slot.match] = alloc[i] as GroupLetter;
  });
  return out;
}
