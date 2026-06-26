import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import type { Predictions } from "@/lib/predictions";
import { type GroupLetter, groupLetters, teamById } from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

interface PredictionTeam {
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

// Join each team's group odds with its per-round reach and market champion price.
function projectTeams(snapshot: Predictions): PredictionTeam[] {
  const reachByCode = new Map(snapshot.reach.map((team) => [team.code, team]));
  return snapshot.groups.flatMap((group) =>
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
}

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

function compactTeam(team: PredictionTeam) {
  return {
    code: team.code,
    name: team.name,
    group: team.group,
    groupStage: {
      winGroupPercent: percent(team.groupStage.first),
      runnerUpPercent: percent(team.groupStage.second),
      advancePercent: percent(team.groupStage.advance),
    },
    knockout: {
      reachRoundOf16Percent: percent(team.knockout.roundOf16),
      reachQuarterfinalPercent: percent(team.knockout.quarterfinal),
      reachSemifinalPercent: percent(team.knockout.semifinal),
      reachFinalPercent: percent(team.knockout.final),
    },
    championPercent: percent(team.champion),
  };
}

function topTeams(teams: PredictionTeam[], limit: number) {
  return [...teams]
    .sort((a, b) => b.champion - a.champion)
    .slice(0, limit)
    .map(compactTeam);
}

function groupTeams(teams: PredictionTeam[], group: GroupLetter) {
  return teams
    .filter((team) => team.group === group)
    .sort(
      (a, b) =>
        b.groupStage.advance - a.groupStage.advance ||
        b.groupStage.first - a.groupStage.first,
    )
    .map(compactTeam);
}

export default defineTool({
  description:
    "World Cup prediction estimates: a single team's run (advance, reach by round, title odds), a group's advancement odds, or the title favorites. For a specific match's score/odds use get_match_forecast; for an undecided knockout matchup use show_knockout_match.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("A country name or code, for that team's outlook."),
    group: groupLetter
      .optional()
      .describe("Group letter, A-L, for its advancement odds."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("Maximum teams for the title ranking."),
  }),
  async execute({ team, group, limit }) {
    const snapshot = await getPredictions();
    const teams = projectTeams(snapshot);
    const updatedAt = snapshot.updatedAt;

    if (team) {
      const code = codeFor(team);
      const found = code ? teams.find((t) => t.code === code) : undefined;
      if (!found) {
        return {
          updatedAt,
          error: "Unknown team.",
          requested: { team },
          knownTeams: teams.map(({ code, name }) => ({ code, name })),
        };
      }
      return { updatedAt, type: "team", team: compactTeam(found) };
    }

    if (group) {
      return {
        updatedAt,
        type: "group",
        group,
        teams: groupTeams(teams, group),
      };
    }

    return {
      updatedAt,
      type: "title_ranking",
      teams: topTeams(teams, limit ?? 8),
    };
  },
  // No view has a widget — the model answers from these numbers. Kept compact so
  // a title ranking doesn't dump the full per-team breakdown into the reply.
  toModelOutput(output) {
    if ("error" in output) {
      const known = (output.knownTeams ?? [])
        .slice(0, 8)
        .map((t) => t.name)
        .join(", ");
      return {
        type: "text",
        value: `Unknown team. Known teams include: ${known}.`,
      };
    }
    if (output.type === "team" && output.team) {
      const t = output.team;
      return {
        type: "text",
        value: `${t.name} (Group ${t.group}): advance ${t.groupStage.advancePercent}%, reach the final ${t.knockout.reachFinalPercent}%, win it all ${t.championPercent}%.`,
      };
    }
    if (output.type === "group") {
      const order = (output.teams ?? [])
        .map((t) => `${t.name} (advance ${t.groupStage.advancePercent}%)`)
        .join(", ");
      return { type: "text", value: `Group ${output.group}: ${order}.` };
    }
    const top = (output.teams ?? [])
      .slice(0, 5)
      .map((t) => `${t.name} ${t.championPercent}%`)
      .join(", ");
    return { type: "text", value: `Title favorites: ${top}.` };
  },
});
