// The flat per-team prediction shape the agent's tool reads, projected from the
// shared cached predictions snapshot (one build serves the page and the agent).

import { getCachedPredictions } from "@/lib/cached-predictions";
import type { Predictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

export interface PredictionTeam {
  code: string;
  name: string;
  group: string;
  groupStage: { first: number; second: number; advance: number };
  knockout: {
    roundOf16: number;
    quarterfinal: number;
    semifinal: number;
    final: number;
  };
  champion: number;
}

export interface PredictionSnapshot {
  updatedAt: string;
  teams: PredictionTeam[];
}

// Flatten the rich snapshot into one row per team: group odds joined with the
// per-round reach probabilities and the market champion price.
function project(snapshot: Predictions): PredictionSnapshot {
  const reachByCode = new Map(snapshot.reach.map((team) => [team.code, team]));
  const teams = snapshot.groups.flatMap((group) =>
    group.teams.map((team) => {
      const reach = reachByCode.get(team.code);
      return {
        code: team.code,
        name: teamById[team.code]?.name ?? team.code,
        group: group.letter,
        groupStage: {
          first: team.first,
          second: team.second,
          advance: team.advance,
        },
        knockout: {
          roundOf16: reach?.r16 ?? 0,
          quarterfinal: reach?.qf ?? 0,
          semifinal: reach?.sf ?? 0,
          final: reach?.final ?? 0,
        },
        champion: reach?.mktChampion ?? 0,
      };
    }),
  );
  return { updatedAt: snapshot.updatedAt, teams };
}

export async function getPredictionSnapshot(): Promise<PredictionSnapshot> {
  return project(await getCachedPredictions());
}
