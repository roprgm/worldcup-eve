// Trace a single team's projected route through the bracket: enter at whichever
// Round-of-32 slot (group winner or runner-up) the market makes likelier, then
// follow the knockout graph to the final, listing each round's likely opponents.
// Pure: takes a snapshot, queries nothing. A team the market no longer puts in a
// top-two group slot has no path — it's eliminated (or could only sneak through
// as a third), and we say so rather than invent a route.

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

// Below this, a team isn't a credible group winner/runner-up — no path is drawn.
const MIN_ENTRY_PROBABILITY = 0.01;
// Below this group-advance chance we call the team out rather than a longshot.
const ELIMINATED_ADVANCE = 0.01;

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
  steps: PathStep[]; // R32 → Final
}

export type TeamPathResult =
  | ({ status: "path" } & TeamPath)
  | {
      status: "out";
      code: string;
      name: string;
      group: GroupLetter;
      advance: number;
    };

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

// The team's own probability of occupying that R32 entry slot — 0 when the slot
// doesn't exist or the market gives the team no chance there (e.g. eliminated).
function entryProbability(
  predictions: Pick<Predictions, "slots">,
  code: string,
  entry: { match: KnockoutMatch; side: Side } | undefined,
): number {
  if (!entry) return 0;
  const slot = predictions.slots.find(
    (s) => s.match === entry.match.number && s.side === entry.side,
  );
  return slot?.candidates.find((c) => c.code === code)?.probability ?? 0;
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

function walk(
  predictions: Pick<Predictions, "slots">,
  entry: { match: KnockoutMatch; side: Side },
): PathStep[] {
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
  return steps;
}

/** A friendly sentence for a team with no projected path. */
export function outMessage(out: { name: string; advance: number }): string {
  return out.advance < ELIMINATED_ADVANCE
    ? `${out.name} is out of the tournament, so there's no road to the final to show.`
    : `${out.name} isn't projected to win or finish runner-up in its group, so there's no clear path to the final to show.`;
}

/** Build the team's projected path, the "out" verdict when it has none, or
 *  `undefined` for an unknown team code. */
export function teamPath(
  predictions: Pick<Predictions, "slots" | "groups">,
  code: string,
): TeamPathResult | undefined {
  const team = teamById[code];
  if (!team) return undefined;

  const advance =
    predictions.groups
      .find((g) => g.letter === team.group)
      ?.teams.find((t) => t.code === code)?.advance ?? 0;

  const firstEntry = entryMatch(team.group, "first");
  const secondEntry = entryMatch(team.group, "second");
  const pFirst = entryProbability(predictions, code, firstEntry);
  const pSecond = entryProbability(predictions, code, secondEntry);

  // Enter at whichever top-two slot the market makes likelier; that's all the
  // placement we need — we don't surface "winner"/"runner-up".
  const entry = pFirst >= pSecond ? firstEntry : secondEntry;
  const probability = Math.max(pFirst, pSecond);

  if (!entry || probability < MIN_ENTRY_PROBABILITY) {
    return { status: "out", code, name: team.name, group: team.group, advance };
  }

  return {
    status: "path",
    code,
    name: team.name,
    group: team.group,
    steps: walk(predictions, entry),
  };
}
