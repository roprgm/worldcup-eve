"use client";

import {
  type PathBranchView,
  TeamPathCard,
} from "@/components/widgets/team-path-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import {
  outMessage,
  type PathBranch,
  teamPath,
} from "@/lib/predictions/team-path";
import { type GroupLetter, teamById, type Round } from "@/lib/tournament";

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third place",
  FINAL: "Final",
};

const PLACEMENT_LABEL: Record<PathBranch["placement"], string> = {
  first: "win",
  second: "finish 2nd in",
  third: "go through 3rd from",
};

const formatPct = (p: number) => `${Math.round(p * 100)}%`;

function branchTitle(branch: PathBranch, group: GroupLetter): string {
  return `If they ${PLACEMENT_LABEL[branch.placement]} Group ${group}`;
}

function branchView(branch: PathBranch, group: GroupLetter): PathBranchView {
  return {
    title: branchTitle(branch, group),
    chance: formatPct(branch.probability),
    steps: branch.steps.map((step) => ({
      roundLabel: ROUND_LABEL[step.round],
      opponents: step.opponents,
    })),
  };
}

type PathView =
  | { status: "path"; subtitle: string; branches: PathBranchView[] }
  | { status: "out"; subtitle: string; note: string };

function pathView(
  predictions: Predictions,
  code: string,
): PathView | undefined {
  const result = teamPath(predictions, code);
  if (!result) return undefined;

  if (result.status === "out") {
    return {
      status: "out",
      subtitle: "Out of the tournament",
      note: outMessage(result),
    };
  }

  const forked = result.branches.length > 1;
  return {
    status: "path",
    subtitle: forked
      ? `Two routes — depends on the Group ${result.group} finish`
      : "Road to the final",
    branches: result.branches.map((b) => branchView(b, result.group)),
  };
}

/** Connected path card: fetches the shared predictions and renders the team's
 *  projected road to the final. When the group is still undecided the route
 *  forks, so it shows one labeled branch per possible finish; an "out" state
 *  replaces them when the team can't reach the knockouts. */
export function TeamPathWidget({ code }: { code: string }) {
  const view = usePredictions((predictions) => pathView(predictions, code));
  const team = teamById[code];

  return (
    <TeamPathCard
      team={team ? { code: team.id, name: team.name } : undefined}
      subtitle={view?.subtitle}
      branches={view?.status === "path" ? view.branches : undefined}
      note={view?.status === "out" ? view.note : undefined}
    />
  );
}
