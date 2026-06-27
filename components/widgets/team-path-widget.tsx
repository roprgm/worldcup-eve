"use client";

import {
  type PathStepView,
  TeamPathCard,
} from "@/components/widgets/team-path-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { teamPath } from "@/lib/predictions/team-path";
import { teamById, type Round } from "@/lib/tournament";

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third place",
  FINAL: "Final",
};

interface PathView {
  team: { code: string; name: string };
  placementLabel: string;
  steps: PathStepView[];
}

function pathView(
  predictions: Predictions,
  code: string,
): PathView | undefined {
  const path = teamPath(predictions, code);
  if (!path) return undefined;
  return {
    team: { code: path.code, name: path.name },
    placementLabel:
      path.placement === "first"
        ? `Group ${path.group} winner`
        : `Group ${path.group} runner-up`,
    steps: path.steps.map((step) => ({
      roundLabel: ROUND_LABEL[step.round],
      matchNumber: step.matchNumber,
      opponents: step.opponents,
    })),
  };
}

/** Connected path card: fetches the shared predictions and renders the team's
 *  projected road to the final. The header shows immediately from static team
 *  data; the per-round opponents fill in once the market loads. */
export function TeamPathWidget({ code }: { code: string }) {
  const view = usePredictions((predictions) => pathView(predictions, code));
  const team = teamById[code];

  return (
    <TeamPathCard
      team={team ? { code: team.id, name: team.name } : undefined}
      placementLabel={view?.placementLabel}
      steps={view?.steps}
    />
  );
}
