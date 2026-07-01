// Shared helpers for the agent tools: team-name resolution, filling in knockout
// team names the static schedule leaves TBD, and probability formatting.

import { getPredictions } from "@/lib/predictions";
import { getMatchResults } from "@/lib/results";
import {
  knockoutMatches,
  matchSchedule,
  type SlotRef,
  teamById,
} from "@/lib/tournament";

// A knockout slot is "decided" once its leading team is all but certain.
const SETTLED = 0.99;

// A 0–1 probability as a one-decimal percentage (0.1234 → 12.3).
export const percent = (value: number) => Math.round(value * 1000) / 10;

export const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

export const norm = (value: string) => value.trim().toLowerCase();

export const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

type Side = "home" | "away";
export type ResolvedSides = { home: string | null; away: string | null };

// Knockout fixtures are TBD in the static schedule. Resolve them from the real
// results first (settled group order + assigned third slots), then fall back to
// prediction slots for anything not yet decided, so a team's next knockout game
// shows up by name as soon as it's known.
export async function resolvedKnockoutTeams(): Promise<
  Map<number, ResolvedSides>
> {
  const resolved = new Map<number, ResolvedSides>();
  const set = (match: number, side: Side, code: string | null) => {
    if (!code) return;
    const sides = resolved.get(match) ?? { home: null, away: null };
    sides[side] = code;
    resolved.set(match, sides);
  };

  try {
    const { settledGroupOrder, thirdSlots } = await getMatchResults();
    const thirdByMatch = new Map(thirdSlots.map((t) => [t.match, t.teamId]));
    const fromResults = (ref: SlotRef, match: number): string | null => {
      if (ref.kind === "winner")
        return settledGroupOrder[ref.group]?.[0] ?? null;
      if (ref.kind === "runner")
        return settledGroupOrder[ref.group]?.[1] ?? null;
      if (ref.kind === "third") return thirdByMatch.get(match) ?? null;
      return null; // match/loser refs resolve from predictions below
    };
    for (const m of knockoutMatches) {
      set(m.number, "home", fromResults(m.home, m.number));
      set(m.number, "away", fromResults(m.away, m.number));
    }
  } catch {
    // Results unavailable — predictions still fill in below.
  }

  try {
    const { slots } = await getPredictions();
    const settled = (match: number, side: Side) => {
      const top = slots.find((s) => s.match === match && s.side === side)
        ?.candidates[0];
      return top && top.probability >= SETTLED ? top.code : null;
    };
    for (const m of matchSchedule) {
      if (m.number <= 72) continue;
      const sides = resolved.get(m.number);
      if (!sides?.home) set(m.number, "home", settled(m.number, "home"));
      if (!sides?.away) set(m.number, "away", settled(m.number, "away"));
    }
  } catch {
    // Predictions unavailable — keep whatever the results gave us.
  }

  return resolved;
}
