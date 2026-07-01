import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import type { Predictions } from "@/lib/predictions";
import { outMessage, teamPath } from "@/lib/predictions/team-path";
import {
  type GroupLetter,
  groupLetters,
  matchByNumber,
  type SlotRef,
  teamById,
  teams,
} from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

const percent = (v: number) => Math.round(v * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third place",
  FINAL: "Final",
};

// Where a slot's team comes from, e.g. "winner of match 95" or "winner of Group A".
function slotSource(ref: SlotRef): string {
  switch (ref.kind) {
    case "winner":
      return `winner of Group ${ref.group}`;
    case "runner":
      return `runner-up of Group ${ref.group}`;
    case "third":
      return `a third-placed team (Groups ${ref.groups.join("/")})`;
    case "match":
      return `winner of match ${ref.match}`;
    case "loser":
      return `loser of match ${ref.match}`;
  }
}

interface TeamOdds {
  code: string;
  name: string;
  group: GroupLetter;
  winGroupPct: number;
  runnerUpPct: number;
  advancePct: number;
  reachR16Pct: number;
  reachQfPct: number;
  reachSfPct: number;
  reachFinalPct: number;
  championPct: number;
}

function projectTeams(snapshot: Predictions): Map<string, TeamOdds> {
  const reach = new Map(snapshot.reach.map((t) => [t.code, t]));
  const out = new Map<string, TeamOdds>();
  for (const group of snapshot.groups)
    for (const team of group.teams) {
      const r = reach.get(team.code);
      out.set(team.code, {
        code: team.code,
        name: teamName(team.code),
        group: group.letter,
        winGroupPct: percent(team.first),
        runnerUpPct: percent(team.second),
        advancePct: percent(team.advance),
        reachR16Pct: percent(r?.r16 ?? 0),
        reachQfPct: percent(r?.qf ?? 0),
        reachSfPct: percent(r?.sf ?? 0),
        reachFinalPct: percent(r?.final ?? 0),
        championPct: percent(r?.mktChampion ?? 0),
      });
    }
  return out;
}

function teamRoute(snapshot: Predictions, code: string) {
  const result = teamPath(snapshot, code);
  if (!result || result.status === "out") return undefined;
  return result.steps.map((step) => ({
    round: ROUND_LABEL[step.round] ?? step.round,
    reachPct: Math.round(step.reachProbability * 100),
    likelyOpponent: step.opponents[0]
      ? `${step.opponents[0].name} (${Math.round(step.opponents[0].probability * 100)}%)`
      : "to be decided",
    venue: step.venues[0]?.venue ?? "to be decided",
  }));
}

export default defineTool({
  description:
    "How far World Cup teams go. Pass a team for its chances to advance / reach each round / win the cup plus its projected route (likely opponent and stadium each round); a group for its advancement odds; top:N for the title favorites; or slot:<73-104> for who's likely to fill an undecided knockout match. Use odds for a single matchup's win chance. To show it, write a `chances` code block (the chances table — holds several teams at once, the default for any how-far question), and a `path` code block only when the user asks who a team could face.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("A team name or code, for its outlook and route."),
    group: groupLetter
      .optional()
      .describe("A group letter, A-L, for its advancement odds."),
    top: z
      .number()
      .int()
      .min(1)
      .max(24)
      .optional()
      .describe("Show the N title favourites."),
    slot: z
      .number()
      .int()
      .min(73)
      .max(104)
      .optional()
      .describe("A knockout match number, for who's likely to play in it."),
  }),
  async execute({ team, group, top, slot }) {
    const snapshot = await getPredictions();

    if (slot) {
      const bracket = matchByNumber[slot];
      const sides = snapshot.slots.filter((s) => s.match === slot);
      const side = (which: "home" | "away") => ({
        source: slotSource(bracket[which]),
        candidates: (sides.find((s) => s.side === which)?.candidates ?? [])
          .filter((c) => c.probability > 0)
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 6)
          .map((c) => ({
            team: teamName(c.code),
            chancePct: percent(c.probability),
          })),
      });
      return {
        kind: "slot" as const,
        match: slot,
        round: ROUND_LABEL[bracket.round] ?? bracket.round,
        venue: bracket.venue,
        home: side("home"),
        away: side("away"),
      };
    }

    const projected = projectTeams(snapshot);

    if (team) {
      const code = codeFor(team);
      const found = code ? projected.get(code) : undefined;
      if (!found) {
        return {
          kind: "unknown" as const,
          knownTeams: teams.map((t) => t.name),
        };
      }
      const route = teamRoute(snapshot, found.code);
      if (!route) {
        return {
          kind: "out" as const,
          team: found.name,
          note: outMessage(found),
        };
      }
      return {
        kind: "team" as const,
        asOf: snapshot.updatedAt,
        ...found,
        route,
      };
    }

    if (group) {
      const teamsIn = [...projected.values()]
        .filter((t) => t.group === group)
        .sort(
          (a, b) =>
            b.advancePct - a.advancePct || b.winGroupPct - a.winGroupPct,
        );
      return {
        kind: "group" as const,
        asOf: snapshot.updatedAt,
        group,
        teams: teamsIn,
      };
    }

    const ranked = [...projected.values()].sort(
      (a, b) => b.championPct - a.championPct,
    );
    return {
      kind: "favorites" as const,
      asOf: snapshot.updatedAt,
      teams: ranked.slice(0, top ?? 8),
    };
  },
  // Keep the model's view compact: a sentence (or a few) instead of every team's
  // full breakdown. The widget tags carry the rich display.
  toModelOutput(output) {
    switch (output.kind) {
      case "unknown":
        return {
          type: "text",
          value: `Unknown team. Known teams include: ${output.knownTeams.slice(0, 8).join(", ")}.`,
        };
      case "out":
        return { type: "text", value: output.note };
      case "slot": {
        const names = (side: typeof output.home) =>
          side.candidates.map((c) => `${c.team} ${c.chancePct}%`).join(", ");
        return {
          type: "text",
          value: `Match ${output.match} (${output.round}, ${output.venue}) — ${output.home.source}: ${names(output.home)}; ${output.away.source}: ${names(output.away)}.`,
        };
      }
      case "team": {
        const route = output.route
          .map(
            (s) =>
              `${s.round} vs ${s.likelyOpponent} at ${s.venue} (reach ${s.reachPct}%)`,
          )
          .join("; ");
        // Give the whole reach ladder, not just the endpoints — otherwise the
        // model invents the missing rounds to bridge them.
        return {
          type: "text",
          value: `${output.name} (Group ${output.group}) — reach chances: qualify from group ${output.advancePct}%, Round of 16 ${output.reachR16Pct}%, quarterfinal ${output.reachQfPct}%, semifinal ${output.reachSfPct}%, final ${output.reachFinalPct}%, win the cup ${output.championPct}%. Route: ${route}.`,
        };
      }
      case "group":
        return {
          type: "text",
          value: `Group ${output.group}: ${output.teams.map((t) => `${t.name} (advance ${t.advancePct}%)`).join(", ")}.`,
        };
      default:
        return {
          type: "text",
          value: `Title favorites: ${output.teams.map((t) => `${t.name} ${t.championPct}%`).join(", ")}.`,
        };
    }
  },
});
