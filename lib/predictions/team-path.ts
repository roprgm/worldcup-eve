// A team's projected route to the final. The bracket position a team lands in
// isn't fixed — Ghana could top its group or finish runner-up (or sneak through
// third), and each lands it in a different Round-of-32 fixture facing different
// teams. So per round we take the UNION of opponents across every match the team
// could be in, weighted by how likely it is to be there. The prediction slots
// already encode that per-match presence (and fold in confirmed results), so a
// settled group narrows the set automatically while anything still possible
// stays on the list. Pure: takes a snapshot, queries nothing.

import {
  knockoutMatches,
  teamById,
  type GroupLetter,
  type Round,
} from "../tournament";
import type { Predictions } from "./index";

type Side = "home" | "away";

// The rounds of a run to the final, in order (the third-place play-off is not
// part of any team's "path to the final").
const PATH_ROUNDS: Round[] = ["R32", "R16", "QF", "SF", "FINAL"];

// Below this Round-of-32 presence the team can't reach the knockouts — it's out.
const MIN_REACH = 0.005;

export interface PathOpponent {
  code: string;
  name: string;
  probability: number; // P(this is the opponent | team reaches the round)
}

export interface PathStep {
  round: Round;
  reachProbability: number; // P(team reaches this round)
  opponents: PathOpponent[]; // sorted high→low; ~sums to 1
}

export interface TeamPath {
  code: string;
  name: string;
  group: GroupLetter;
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

  for (const match of knockoutMatches) {
    if (match.round !== round) continue;
    for (const side of ["home", "away"] as const) {
      const here = teamProbIn(predictions, match.number, side, code);
      if (here <= 0) continue;
      reach += here;
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

  return { round, reachProbability: reach, opponents };
}

/** A friendly sentence for a team with no projected path. */
export function outMessage(out: { name: string }): string {
  return `${out.name} is out of the tournament, so there's no road to the final to show.`;
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

  return { status: "path", code, name: team.name, group: team.group, steps };
}
