// The agent-facing projections of the shared cached predictions snapshot (one
// build serves the page and the agent): the flat per-team odds the prediction
// tool reads, and the per-knockout-slot contenders the slot tool reads.

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

export interface SlotCandidate {
  code: string;
  name: string;
  probability: number;
}

export interface KnockoutSlots {
  updatedAt: string;
  /** Likely teams per knockout slot (matches 73–104), by match number, for the
   * matchups whose sides aren't decided yet. Candidates are sorted high→low. */
  slots: Record<number, { home: SlotCandidate[]; away: SlotCandidate[] }>;
}

const teamName = (code: string) => teamById[code]?.name ?? code;

// Flatten the rich snapshot into one row per team: group odds joined with the
// per-round reach probabilities and the market champion price.
function projectTeams(snapshot: Predictions): PredictionTeam[] {
  const reachByCode = new Map(snapshot.reach.map((team) => [team.code, team]));
  return snapshot.groups.flatMap((group) =>
    group.teams.map((team) => {
      const reach = reachByCode.get(team.code);
      return {
        code: team.code,
        name: teamName(team.code),
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
}

function projectSlots(snapshot: Predictions): KnockoutSlots["slots"] {
  const slots: KnockoutSlots["slots"] = {};
  for (const slot of snapshot.slots) {
    const entry = (slots[slot.match] ??= { home: [], away: [] });
    entry[slot.side] = slot.candidates.map((candidate) => ({
      code: candidate.code,
      name: teamName(candidate.code),
      probability: candidate.probability,
    }));
  }
  return slots;
}

export async function getPredictionSnapshot(): Promise<PredictionSnapshot> {
  const snapshot = await getCachedPredictions();
  return { updatedAt: snapshot.updatedAt, teams: projectTeams(snapshot) };
}

export async function getKnockoutSlots(): Promise<KnockoutSlots> {
  const snapshot = await getCachedPredictions();
  return { updatedAt: snapshot.updatedAt, slots: projectSlots(snapshot) };
}
