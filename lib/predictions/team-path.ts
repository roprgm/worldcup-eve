// A team's projected route to the final: one compact path, with each round's
// likely opponents from the prediction slots (which already fold in confirmed
// results). When the group isn't settled the team can enter the bracket at more
// than one Round-of-32 slot — different opponents per finish — so per round we
// blend those routes weighted by the team's presence, and flag `dependsOnGroup`
// so the UI can note that the chances hinge on the group result. Pure: takes a
// snapshot, queries nothing.

import {
  knockoutMatches,
  teamById,
  type GroupLetter,
  type Round,
} from "../tournament";
import type { Predictions } from "./index";

type Side = "home" | "away";
type Placement = "first" | "second" | "third";

// The rounds of a run to the final, in order (the third-place play-off is not
// part of any team's "path to the final").
const PATH_ROUNDS: Round[] = ["R32", "R16", "QF", "SF", "FINAL"];

// Below this Round-of-32 presence the team can't reach the knockouts — it's out.
const MIN_REACH = 0.005;
// A group finish only counts toward the fork above this chance.
const MIN_PLACEMENT = 0.05;

export interface PathOpponent {
  code: string;
  name: string;
  probability: number; // P(this is the opponent | team reaches the round)
}

export interface PathVenue {
  venue: string;
  probability: number; // P(team plays here | team reaches the round)
}

export interface PathStep {
  round: Round;
  reachProbability: number; // P(team reaches this round)
  opponents: PathOpponent[]; // sorted high→low; ~sums to 1
  // The stadium(s) this round could be played at — always known, since every
  // knockout match number has a fixed venue. More than one only when the team
  // could still enter the bracket at different slots (see dependsOnGroup).
  venues: PathVenue[]; // sorted high→low; ~sums to 1
}

export interface TeamPath {
  code: string;
  name: string;
  group: GroupLetter;
  /** True when more than one group finish is still in play, so the opponents
   *  blend those routes and hinge on where the team finishes its group. */
  dependsOnGroup: boolean;
  steps: PathStep[]; // R32 → Final
}

export type TeamPathResult =
  | ({ status: "path" } & TeamPath)
  | { status: "out"; code: string; name: string; group: GroupLetter };

const opponentView = (code: string, probability: number): PathOpponent => ({
  code,
  name: teamById[code]?.name ?? code,
  probability,
});

const slotCandidates = (
  predictions: Pick<Predictions, "slots">,
  match: number,
  side: Side,
) =>
  predictions.slots.find((s) => s.match === match && s.side === side)
    ?.candidates ?? [];

const teamProbIn = (
  predictions: Pick<Predictions, "slots">,
  match: number,
  side: Side,
  code: string,
) =>
  slotCandidates(predictions, match, side).find((c) => c.code === code)
    ?.probability ?? 0;

const placementOf = (kind: string): Placement | undefined =>
  kind === "winner"
    ? "first"
    : kind === "runner"
      ? "second"
      : kind === "third"
        ? "third"
        : undefined;

// Opponents the team could meet in one round: across every match it might occupy
// there, blend the other side's candidates weighted by the team's presence, then
// normalize to "given the team reaches this round, who does it face".
function roundStep(
  predictions: Pick<Predictions, "slots">,
  code: string,
  round: Round,
): PathStep {
  let reach = 0;
  const weight = new Map<string, number>();
  const venueWeight = new Map<string, number>();

  for (const match of knockoutMatches) {
    if (match.round !== round) continue;
    for (const side of ["home", "away"] as const) {
      const here = teamProbIn(predictions, match.number, side, code);
      if (here <= 0) continue;
      reach += here;
      venueWeight.set(match.venue, (venueWeight.get(match.venue) ?? 0) + here);
      const opponentSide: Side = side === "home" ? "away" : "home";
      for (const c of slotCandidates(predictions, match.number, opponentSide)) {
        if (c.probability <= 0) continue;
        weight.set(c.code, (weight.get(c.code) ?? 0) + here * c.probability);
      }
    }
  }

  const opponents =
    reach > 0
      ? [...weight]
          .map(([c, w]) => opponentView(c, w / reach))
          .sort((a, b) => b.probability - a.probability)
      : [];
  const venues =
    reach > 0
      ? [...venueWeight]
          .map(([venue, w]) => ({ venue, probability: w / reach }))
          .sort((a, b) => b.probability - a.probability)
      : [];

  return { round, reachProbability: reach, opponents, venues };
}

// The set of group finishes (1st / 2nd / 3rd) that still have a real chance —
// more than one means the path forks on the group result.
function livePlacements(
  predictions: Pick<Predictions, "slots">,
  code: string,
): Set<Placement> {
  const placements = new Set<Placement>();
  for (const match of knockoutMatches) {
    if (match.round !== "R32") continue;
    for (const side of ["home", "away"] as const) {
      const p = teamProbIn(predictions, match.number, side, code);
      if (p < MIN_PLACEMENT) continue;
      const placement = placementOf(match[side].kind);
      if (placement) placements.add(placement);
    }
  }
  return placements;
}

/** A friendly sentence for a team with no projected path. */
export function outMessage(out: { name: string }): string {
  return `${out.name} is out of the tournament, so there's no road to the final to show.`;
}

// One match on the way to a target round: the likely opponents and the running
// chance to reach the next round once it's won.
export interface PathLeg {
  round: Round;
  opponents: PathOpponent[];
  reachNext: number;
}

// The chain of matches a team must win to reach `targetRound`, ending at the
// cell's own probability.
export interface CellPath {
  code: string;
  name: string;
  targetRound: Round;
  reachProbability: number; // equals the table cell
  dependsOnGroup: boolean;
  legs: PathLeg[];
}

// Matches to win to reach each column (R32 is the group result, the cup a market).
const TARGET_LEGS: Partial<Record<Round, number>> = {
  R16: 1,
  QF: 2,
  SF: 3,
  FINAL: 4,
};

export interface CellPathOptions {
  /** Reach at or below this is treated as "can't get there" → `undefined`. Pass 0
   *  to keep the longest shots (any still-alive team). */
  minReach?: number;
  /** The round the team is already confirmed into from played results. The path
   *  then starts there and conditions every later chance on the team being in it
   *  (its reach there becomes a certain 1), so a match already won isn't shown as
   *  a pending prediction. Omit for the unconditional path from R32. */
  fromRound?: Round;
}

/** The per-cell breakdown behind a team's chance to reach `targetRound`: the
 *  matches it must win and the likely opponent at each. `undefined` for an
 *  unknown team, a non-reach column (R32 / cup), a team that can't get there, or
 *  one already at/past the target. */
export function cellPath(
  predictions: Pick<Predictions, "slots">,
  code: string,
  targetRound: Round,
  { minReach = MIN_REACH, fromRound }: CellPathOptions = {},
): CellPath | undefined {
  const team = teamById[code];
  const legCount = TARGET_LEGS[targetRound];
  if (!team || legCount == null) return undefined;

  const steps = PATH_ROUNDS.map((round) => roundStep(predictions, code, round));

  const fromIdx = fromRound ? PATH_ROUNDS.indexOf(fromRound) : 0;
  const base = fromRound ? steps[fromIdx].reachProbability : 1;
  if (fromIdx >= legCount || base <= 0) return undefined;

  // Chance to reach a round, conditioned on the team being in `fromRound`.
  const reachOf = (idx: number) => steps[idx].reachProbability / base;
  if (reachOf(legCount) <= minReach) return undefined;

  const legs: PathLeg[] = [];
  for (let k = fromIdx; k < legCount; k++) {
    legs.push({
      round: PATH_ROUNDS[k],
      opponents: steps[k].opponents,
      reachNext: reachOf(k + 1),
    });
  }

  return {
    code,
    name: team.name,
    targetRound,
    reachProbability: reachOf(legCount),
    dependsOnGroup: livePlacements(predictions, code).size > 1,
    legs,
  };
}

/** Build the team's projected path, the "out" verdict when it can't reach the
 *  knockouts, or `undefined` for an unknown team code. */
export function teamPath(
  predictions: Pick<Predictions, "slots">,
  code: string,
): TeamPathResult | undefined {
  const team = teamById[code];
  if (!team) return undefined;

  const steps = PATH_ROUNDS.map((round) => roundStep(predictions, code, round));
  const r32 = steps[0];
  if (!r32 || r32.reachProbability < MIN_REACH) {
    return { status: "out", code, name: team.name, group: team.group };
  }

  return {
    status: "path",
    code,
    name: team.name,
    group: team.group,
    dependsOnGroup: livePlacements(predictions, code).size > 1,
    steps,
  };
}
