// A team's projected route to the final. Before a group is settled the route
// forks on where the team finishes: Algeria topping Group J enters one R32
// fixture (and a whole bracket region), finishing runner-up enters a different
// one against a different side. Those are genuinely different roads, so we show
// one branch per still-possible finish (1st / 2nd / through as a third) rather
// than blending them. Each branch walks the bracket deterministically from its
// entry, listing the likely teams in the opposing slot each round from the
// prediction slots (which already fold in confirmed results, so a settled group
// collapses to a single branch). Pure: takes a snapshot, queries nothing.

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
type Placement = "first" | "second" | "third";

// Below this total Round-of-32 presence the team can't reach the knockouts.
const MIN_REACH = 0.005;
// A secondary branch is only worth showing above this chance (the top branch is
// always kept). Caps how many forks we render.
const MIN_BRANCH = 0.05;
const MAX_BRANCHES = 3;

export interface PathOpponent {
  code: string;
  name: string;
  probability: number; // P(this team fills the opposing slot)
}

export interface PathStep {
  round: Round;
  opponents: PathOpponent[]; // sorted high→low
}

export interface PathBranch {
  placement: Placement;
  probability: number; // P(team takes this branch — i.e. finishes here)
  steps: PathStep[]; // R32 → Final
}

export interface TeamPath {
  code: string;
  name: string;
  group: GroupLetter;
  branches: PathBranch[]; // sorted high→low; one when the group is settled
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

function opponentsAt(
  predictions: Pick<Predictions, "slots">,
  match: KnockoutMatch,
  teamSide: Side,
): PathOpponent[] {
  const opponentSide: Side = teamSide === "home" ? "away" : "home";
  return slotCandidates(predictions, match.number, opponentSide)
    .filter((c) => c.probability > 0)
    .map((c) => opponentView(c.code, c.probability))
    .sort((a, b) => b.probability - a.probability);
}

// Walk the bracket from an R32 entry to the final, reading the opposing slot at
// each step. The team's match each round is fixed once its entry is — only who
// fills the other side is uncertain, and that comes from the slots.
function walkChain(
  predictions: Pick<Predictions, "slots">,
  entry: KnockoutMatch,
  entrySide: Side,
): PathStep[] {
  const steps: PathStep[] = [];
  let current: KnockoutMatch | undefined = entry;
  let side = entrySide;
  while (current) {
    steps.push({
      round: current.round,
      opponents: opponentsAt(predictions, current, side),
    });
    if (!current.feedsInto) break;
    const next: KnockoutMatch | undefined = matchByNumber[current.feedsInto];
    if (!next) break;
    side =
      next.home.kind === "match" && next.home.match === current.number
        ? "home"
        : "away";
    current = next;
  }
  return steps;
}

interface Entry {
  match: KnockoutMatch;
  side: Side;
  placement: Placement;
  probability: number;
}

// Every Round-of-32 slot the team can still occupy, with the group finish that
// puts it there and the market chance of it.
function r32Entries(
  predictions: Pick<Predictions, "slots">,
  code: string,
): Entry[] {
  const entries: Entry[] = [];
  for (const match of knockoutMatches) {
    if (match.round !== "R32") continue;
    for (const side of ["home", "away"] as const) {
      const probability = teamProbIn(predictions, match.number, side, code);
      if (probability <= 0) continue;
      const placement = placementOf(match[side].kind);
      if (placement) entries.push({ match, side, placement, probability });
    }
  }
  return entries;
}

/** A friendly sentence for a team with no projected path. */
export function outMessage(out: { name: string }): string {
  return `${out.name} is out of the tournament, so there's no road to the final to show.`;
}

/** Build the team's projected path (one branch per still-possible group finish),
 *  the "out" verdict when it can't reach the knockouts, or `undefined` for an
 *  unknown team code. */
export function teamPath(
  predictions: Pick<Predictions, "slots">,
  code: string,
): TeamPathResult | undefined {
  const team = teamById[code];
  if (!team) return undefined;

  const entries = r32Entries(predictions, code);
  const total = entries.reduce((sum, e) => sum + e.probability, 0);
  if (total < MIN_REACH) {
    return { status: "out", code, name: team.name, group: team.group };
  }

  // Collapse to one branch per placement: there's a single winner/runner-up slot,
  // but a third-place finish can reach several, so keep the likeliest as the
  // representative chain while summing the chance across them.
  const byPlacement = new Map<Placement, { rep: Entry; probability: number }>();
  for (const e of entries) {
    const cur = byPlacement.get(e.placement);
    if (!cur) {
      byPlacement.set(e.placement, { rep: e, probability: e.probability });
    } else {
      cur.probability += e.probability;
      if (e.probability > cur.rep.probability) cur.rep = e;
    }
  }

  const branches = [...byPlacement.values()]
    .map(({ rep, probability }) => ({
      placement: rep.placement,
      probability,
      steps: walkChain(predictions, rep.match, rep.side),
    }))
    .sort((a, b) => b.probability - a.probability)
    .filter((b, i) => i === 0 || b.probability >= MIN_BRANCH)
    .slice(0, MAX_BRANCHES);

  return { status: "path", code, name: team.name, group: team.group, branches };
}
