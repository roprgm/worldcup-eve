"use client";

import {
  type PathStepView,
  TeamPathCard,
} from "@/components/widgets/team-path-card";
import { usePredictions } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { outMessage, teamPath } from "@/lib/predictions/team-path";
import { teamById, type Round } from "@/lib/tournament";

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third place",
  FINAL: "Final",
};

type PathView =
  | { status: "path"; steps: PathStepView[] }
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

  return {
    status: "path",
    steps: result.steps.map((step) => ({
      roundLabel: ROUND_LABEL[step.round],
      reachProbability: step.reachProbability,
      opponents: step.opponents,
    })),
  };
}

/** Connected path card: fetches the shared predictions and renders the team's
 *  projected road to the final — or an "out" state when the market no longer
 *  puts the team on a knockout path. The header shows immediately from static
 *  team data; the per-round opponents fill in once the market loads. */
export function TeamPathWidget({ code }: { code: string }) {
  const view = usePredictions((predictions) => pathView(predictions, code));
  const team = teamById[code];

  return (
    <TeamPathCard
      team={team ? { code: team.id, name: team.name } : undefined}
      subtitle={view?.status === "out" ? view.subtitle : undefined}
      steps={view?.status === "path" ? view.steps : undefined}
      note={view?.status === "out" ? view.note : undefined}
    />
  );
}
