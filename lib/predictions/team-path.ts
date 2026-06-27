// Trace a single team's projected route through the bracket: assuming it tops
// (or, if likelier, finishes runner-up in) its group, follow the knockout graph
// from its Round-of-32 fixture to the final, listing each round's likely
// opponents from the prediction slots. Pure: takes a snapshot, queries nothing.

import {
  knockoutMatches,
  matchByNumber,
  teamById,
  type GroupLetter,
  type KnockoutMatch,
  type Round,
} from "../tournament";
import type { Predictions } from "./index";

type Side = "home" | "away";

export interface PathOpponent {
  code: string;
  name: string;
  probability: number;
}

export interface PathStep {
  round: Round;
  matchNumber: number;
  venue: string;
  kickoffAt: string;
  opponents: PathOpponent[]; // sorted high→low
}

export interface TeamPath {
  code: string;
  name: string;
  group: GroupLetter;
  /** The group finish the path assumes — whichever the market deems likelier. */
  placement: "first" | "second";
  steps: PathStep[]; // R32 → Final
}

const opponentView = (c: {
  code: string;
  probability: number;
}): PathOpponent => ({
  code: c.code,
  name: teamById[c.code]?.name ?? c.code,
  probability: c.probability,
});

// The R32 fixture a group's winner (or runner-up) drops into, with the side that
// slot occupies — the starting point of the team's walk up the bracket.
function entryMatch(
  group: GroupLetter,
  placement: "first" | "second",
): { match: KnockoutMatch; side: Side } | undefined {
  const kind = placement === "first" ? "winner" : "runner";
  for (const match of knockoutMatches) {
    if (match.round !== "R32") continue;
    for (const side of ["home", "away"] as const) {
      const ref = match[side];
      if (ref.kind === kind && ref.group === group) return { match, side };
    }
  }
  return undefined;
}

// Which side of the next match our team feeds — the one whose ref is the winner
// of the match it just came from.
function nextSide(next: KnockoutMatch, fromMatch: number): Side {
  return next.home.kind === "match" && next.home.match === fromMatch
    ? "home"
    : "away";
}

function opponentsFor(
  predictions: Pick<Predictions, "slots">,
  matchNumber: number,
  teamSide: Side,
): PathOpponent[] {
  const opponentSide: Side = teamSide === "home" ? "away" : "home";
  const slot = predictions.slots.find(
    (s) => s.match === matchNumber && s.side === opponentSide,
  );
  return (slot?.candidates ?? [])
    .filter((c) => c.probability > 0)
    .map(opponentView)
    .sort((a, b) => b.probability - a.probability);
}

/** Build the team's projected path, or `undefined` if the code never reaches a
 *  Round-of-32 slot (it isn't a top-two group finisher anywhere). */
export function teamPath(
  predictions: Pick<Predictions, "slots" | "groups">,
  code: string,
): TeamPath | undefined {
  const team = teamById[code];
  if (!team) return undefined;

  const odds = predictions.groups
    .find((g) => g.letter === team.group)
    ?.teams.find((t) => t.code === code);
  const placement = odds && odds.second > odds.first ? "second" : "first";

  const entry = entryMatch(team.group, placement);
  if (!entry) return undefined;

  const steps: PathStep[] = [];
  let current: KnockoutMatch | undefined = entry.match;
  let side = entry.side;
  while (current) {
    steps.push({
      round: current.round,
      matchNumber: current.number,
      venue: current.venue,
      kickoffAt: current.kickoffAt,
      opponents: opponentsFor(predictions, current.number, side),
    });
    if (!current.feedsInto) break;
    const next: KnockoutMatch | undefined = matchByNumber[current.feedsInto];
    if (!next) break;
    side = nextSide(next, current.number);
    current = next;
  }

  return { code, name: team.name, group: team.group, placement, steps };
}
