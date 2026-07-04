// Turning a bracket into a sequence of "A or B" questions. Walking the knockout
// graph from the Round of 32 inward, every match becomes one question whose two
// teams follow from the model's own earlier picks — so the model commits to a
// full, self-consistent bracket without ever seeing which matches have really
// been played. This is the whole shape of an arena run.

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

/** A question that was actually asked, with the winner the model chose plus the
 *  reasoning and raw reply it came from — kept for scoring and the debug view. */
export interface AskedQuestion extends Matchup {
  pick: TeamCode;
  /** The model's written justification for the pick, when it gave one. */
  reasoning?: string;
  /** The model's native reasoning/thinking tokens, when the provider returns them. */
  thinking?: string;
  /** The full raw reply, verbatim. */
  raw?: string;
}

/** The two teams contesting a match, given the R32 occupants and the winners the
 *  model has picked so far. A side is `undefined` when its feeder isn't picked
 *  yet (e.g. an R32 slot that the group stage hasn't filled). Reality is never
 *  consulted here — the bracket is built purely from the model's own picks. */
function sides(
  match: KnockoutMatch,
  board: Board,
  picks: Record<number, TeamCode>,
): { home?: TeamCode; away?: TeamCode } {
  const teamOf = (side: Side): TeamCode | undefined => {
    const ref = side === "home" ? match.home : match.away;
    if (ref.kind === "match") return picks[ref.match];
    // R32 sides come from group/third slots, not earlier matches.
    return board.slots[slotKey(match.number, side)];
  };
  return { home: teamOf("home"), away: teamOf("away") };
}

/** The round-by-round matchups a set of picks defines, reconstructed from the
 *  board and the picks alone (no model, no reasoning). Used to show a human
 *  bracket's picks the same way a model run's are. */
export function matchupsFromPicks(
  board: Board,
  picks: Record<number, TeamCode>,
): AskedQuestion[] {
  const questions: AskedQuestion[] = [];
  for (const match of bracketMatches) {
    const { home, away } = sides(match, board, picks);
    const pick = picks[match.number];
    if (home && away && pick)
      questions.push({
        match: match.number,
        round: match.round,
        home,
        away,
        pick,
      });
  }
  return questions;
}

/** Decide one match — the answer to a single "A or B" question. */
export type Decider = (m: Matchup) => Promise<{
  pick: TeamCode;
  reasoning?: string;
  thinking?: string;
  raw?: string;
}>;

/** Walk the bracket R32 → final, asking `decide` for every match whose two teams
 *  are known (from the R32 slots and the picks already made). Every match is
 *  asked — including ones that have really been played — so the model predicts a
 *  complete bracket and can be scored the moment a match finishes. A match with
 *  an unresolved side is skipped, leaving a gap the later rounds inherit. */
export async function predictBracket(
  board: Board,
  decide: Decider,
): Promise<{ picks: Record<number, TeamCode>; questions: AskedQuestion[] }> {
  const picks: Record<number, TeamCode> = {};
  const questions: AskedQuestion[] = [];

  for (const match of bracketMatches) {
    const { home, away } = sides(match, board, picks);
    if (!home || !away) continue; // a side isn't known — can't ask this one

    const matchup: Matchup = {
      match: match.number,
      round: match.round,
      home,
      away,
    };
    const { pick, reasoning, thinking, raw } = await decide(matchup);
    // Guard against a stray reply: only the two contenders are valid winners.
    const winner = pick === away ? away : home;
    picks[match.number] = winner;
    questions.push({ ...matchup, pick: winner, reasoning, thinking, raw });
  }

  return { picks, questions };
}
