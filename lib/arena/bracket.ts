// Turning a bracket into a sequence of "A or B" questions. Walking the knockout
// graph from the Round of 32 inward, every undecided match whose two teams are
// known becomes one question; the answer advances a team, which in turn resolves
// the matchups of later rounds. This is the whole shape of an arena run.

import {
  type KnockoutMatch,
  knockoutMatches,
  type Round,
} from "@/lib/tournament";
import { type Board, type Side, slotKey, type TeamCode } from "./board";

/** The knockout matches that make up the visual bracket (R32 → final), ordered
 *  so every match comes after the two it feeds on. The third-place play-off
 *  (103) isn't part of the ring, so it's left out. */
export const bracketMatches: KnockoutMatch[] = knockoutMatches
  .filter((m) => m.round !== "TP")
  .sort((a, b) => a.number - b.number);

/** A single decidable match: who is playing whom, and in which round. */
export interface Matchup {
  match: number;
  round: Round;
  home: TeamCode;
  away: TeamCode;
}

/** A question that was actually asked, with the winner the model chose and the
 *  raw reply it came from — kept for scoring and debugging. */
export interface AskedQuestion extends Matchup {
  pick: TeamCode;
  raw?: string;
}

/** The two teams contesting a match, given the board and the winners resolved so
 *  far. A side is `undefined` when its feeder isn't decided yet. */
function sides(
  match: KnockoutMatch,
  board: Board,
  resolved: Record<number, TeamCode>,
): { home?: TeamCode; away?: TeamCode } {
  const teamOf = (side: Side): TeamCode | undefined => {
    const ref = side === "home" ? match.home : match.away;
    if (ref.kind === "match")
      return board.winners[ref.match] ?? resolved[ref.match];
    // R32 sides come from group/third slots, not earlier matches.
    return board.slots[slotKey(match.number, side)];
  };
  return { home: teamOf("home"), away: teamOf("away") };
}

/** Decide one match — the answer to a single "A or B" question. */
export type Decider = (m: Matchup) => Promise<{ pick: TeamCode; raw?: string }>;

/** Walk the bracket R32 → final, asking `decide` for every undecided match whose
 *  two teams are both known. Real results are used as-is (never asked), and a
 *  match with an unresolved side is skipped — leaving a gap the later rounds
 *  inherit. Returns only the predicted winners (not the locked ones) and the
 *  questions asked, in order. */
export async function predictBracket(
  board: Board,
  decide: Decider,
): Promise<{ picks: Record<number, TeamCode>; questions: AskedQuestion[] }> {
  const resolved: Record<number, TeamCode> = { ...board.winners };
  const picks: Record<number, TeamCode> = {};
  const questions: AskedQuestion[] = [];

  for (const match of bracketMatches) {
    if (resolved[match.number]) continue; // already settled by a real result
    const { home, away } = sides(match, board, resolved);
    if (!home || !away) continue; // a side isn't known — can't ask this one

    const matchup: Matchup = {
      match: match.number,
      round: match.round,
      home,
      away,
    };
    const { pick, raw } = await decide(matchup);
    // Guard against a stray reply: only the two contenders are valid winners.
    const winner = pick === away ? away : home;
    resolved[match.number] = winner;
    picks[match.number] = winner;
    questions.push({ ...matchup, pick: winner, raw });
  }

  return { picks, questions };
}
