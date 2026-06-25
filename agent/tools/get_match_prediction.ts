import { defineTool } from "eve/tools";
import { z } from "zod";

import { type GroupLetter, groupLetter } from "@/agent/lib/groups";
import {
  getPredictionSnapshot,
  type PredictionTeam,
} from "@/agent/lib/predictions-snapshot";
import { codeFor } from "@/agent/lib/team-aliases";

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
    "World Cup prediction estimates: a single team's run (advance, reach by round, title odds), a group's advancement odds, or the title favorites. For a specific match's score/odds use get_match_forecast; for an undecided knockout matchup use get_knockout_forecast.",
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
    const snapshot = await getPredictionSnapshot();

    if (team) {
      const code = codeFor(team);
      const found = code
        ? snapshot.teams.find((t) => t.code === code)
        : undefined;
      if (!found) {
        return {
          updatedAt: snapshot.updatedAt,
          error: "Unknown team.",
          requested: { team },
          knownTeams: snapshot.teams.map(({ code, name }) => ({ code, name })),
        };
      }
      return {
        updatedAt: snapshot.updatedAt,
        type: "team",
        team: compactTeam(found),
      };
    }

    if (group) {
      return {
        updatedAt: snapshot.updatedAt,
        type: "group",
        group,
        teams: groupTeams(snapshot.teams, group),
      };
    }

    return {
      updatedAt: snapshot.updatedAt,
      type: "title_ranking",
      teams: topTeams(snapshot.teams, limit ?? 8),
    };
  },
});
