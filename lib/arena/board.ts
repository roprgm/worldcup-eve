// The live board a bracket prediction is laid over: which teams occupy the
// Round-of-32 slots, and which knockout matches already have a real winner.
// Derived from the results feed and shared by the bracket builder, the arena
// prediction script, and the /arena pages.

import type { Results } from "@/lib/results";
import { matchByNumber, teamById } from "@/lib/tournament";

export type TeamCode = string; // 3-letter FIFA code
export type Side = "home" | "away";
export type SlotKey = `${number}:${Side}`;

export const slotKey = (match: number, side: Side): SlotKey =>
  `${match}:${side}`;

/** R32 occupants from the scoreboard. ESPN uses slot placeholders ("2A") until
 *  a side is settled, so only real team codes count as occupants. */
export function confirmedSlots(results: Results): Record<SlotKey, TeamCode> {
  const slots: Record<SlotKey, TeamCode> = {};
  for (const m of results.matches) {
    if (matchByNumber[m.n]?.round !== "R32") continue;
    for (const side of ["home", "away"] as const) {
      const code = m[side].code;
      if (teamById[code]) slots[slotKey(m.n, side)] = code;
    }
  }
  return slots;
}

/** Played knockout matches, by match number → the actual winner's team code. */
export function playedWinners(results: Results): Record<number, TeamCode> {
  const winners: Record<number, TeamCode> = {};
  const byNumber = new Map(results.matches.map((m) => [m.n, m]));
  for (const [num, side] of Object.entries(results.knockoutPicks)) {
    const match = byNumber.get(Number(num));
    const code = side === "home" ? match?.home.code : match?.away.code;
    if (code) winners[Number(num)] = code;
  }
  return winners;
}

/** The board every bracket is drawn on: the R32 occupants and the played
 *  winners, derived from the live results. */
export interface Board {
  slots: Record<SlotKey, TeamCode>;
  winners: Record<number, TeamCode>;
}

export function buildBoard(results: Results): Board {
  return { slots: confirmedSlots(results), winners: playedWinners(results) };
}
