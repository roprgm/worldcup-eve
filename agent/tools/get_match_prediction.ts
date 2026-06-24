import { defineTool } from "eve/tools";
import { z } from "zod";

import { type GroupLetter, groupLetter } from "@/agent/lib/groups";
import scheduleData from "@/agent/lib/schedule";
import predictions from "@/data/predictions.json";

type PredictionTeam = (typeof predictions.teams)[number];

const teams = predictions.teams;
const teamByCode = new Map(teams.map((team) => [team.code, team]));

const extraAliases: Record<string, string> = {
  bosnia: "BIH",
  "bosnia and herzegovina": "BIH",
  "cabo verde": "CPV",
  "cape verde": "CPV",
  "cote divoire": "CIV",
  curacao: "CUW",
  "czech republic": "CZE",
  "democratic republic of congo": "COD",
  "dr congo": "COD",
  holland: "NED",
  "ivory coast": "CIV",
  korea: "KOR",
  mexico: "MEX",
  "south korea": "KOR",
  turkey: "TUR",
  turkiye: "TUR",
  "u s": "USA",
  "u s a": "USA",
  "united states": "USA",
  "united states of america": "USA",
  usa: "USA",
};

function lookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const teamAliases = new Map<string, PredictionTeam>();

for (const team of teams) {
  teamAliases.set(lookupKey(team.code), team);
  teamAliases.set(lookupKey(team.name), team);
}

for (const [alias, code] of Object.entries(extraAliases)) {
  const team = teamByCode.get(code);
  if (team) teamAliases.set(lookupKey(alias), team);
}

function teamFor(value?: string | null): PredictionTeam | undefined {
  return value ? teamAliases.get(lookupKey(value)) : undefined;
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

function predictionScore(team: PredictionTeam): number {
  return (
    team.groupStage.advance * 0.4 +
    team.groupStage.first * 0.7 +
    team.groupStage.second * 0.35 +
    team.knockout.roundOf16 +
    team.knockout.quarterfinal * 1.5 +
    team.knockout.semifinal * 2.2 +
    team.knockout.final * 3 +
    team.champion * 5
  );
}

function confidenceLabel(probability: number): string {
  const gap = Math.abs(probability - 0.5);
  if (gap < 0.06) return "toss-up";
  if (gap < 0.15) return "slight favorite";
  if (gap < 0.3) return "clear favorite";
  return "strong favorite";
}

function compareTeams(teamA: PredictionTeam, teamB: PredictionTeam) {
  const scoreA = predictionScore(teamA);
  const scoreB = predictionScore(teamB);
  const probabilityA = scoreA + scoreB === 0 ? 0.5 : scoreA / (scoreA + scoreB);
  const probabilityB = 1 - probabilityA;
  const favorite = probabilityA >= probabilityB ? teamA : teamB;
  const favoriteProbability =
    favorite.code === teamA.code ? probabilityA : probabilityB;

  return {
    favorite: compactTeam(favorite),
    confidence: confidenceLabel(favoriteProbability),
    teams: [
      {
        ...compactTeam(teamA),
        estimatedWinPercent: percent(probabilityA),
      },
      {
        ...compactTeam(teamB),
        estimatedWinPercent: percent(probabilityB),
      },
    ],
    note: "Directional estimate from a static prediction snapshot.",
  };
}

function topTeams(limit: number) {
  return [...teams]
    .sort((a, b) => b.champion - a.champion)
    .slice(0, limit)
    .map(compactTeam);
}

function groupTeams(group: GroupLetter) {
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
    "Static World Cup prediction estimates for likely winners, favorites, title chances, and group advancement.",
  inputSchema: z.object({
    matchId: z
      .number()
      .int()
      .min(1)
      .max(104)
      .optional()
      .describe("World Cup match id, when the user asks about a known match."),
    teamA: z
      .string()
      .optional()
      .describe("First country name or code for a matchup comparison."),
    teamB: z
      .string()
      .optional()
      .describe("Second country name or code for a matchup comparison."),
    team: z
      .string()
      .optional()
      .describe("One country name or code for a single-team prediction."),
    group: groupLetter.optional().describe("Group letter, A-L."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("Maximum teams to return for title rankings."),
  }),
  async execute({ matchId, teamA, teamB, team, group, limit }) {
    const match = matchId
      ? scheduleData.find((match) => match.number === matchId)
      : undefined;

    if (matchId && !match) {
      return {
        updatedAt: predictions.updatedAt,
        error: "Match not found.",
        requested: { matchId },
      };
    }

    if (matchId && (!match?.teamA || !match.teamB)) {
      return {
        updatedAt: predictions.updatedAt,
        type: "matchup",
        matchId,
        error: "Match teams are not known yet.",
      };
    }

    const firstTeamInput = match?.teamA ?? teamA;
    const secondTeamInput = match?.teamB ?? teamB;
    const firstTeam = teamFor(firstTeamInput);
    const secondTeam = teamFor(secondTeamInput);

    if (firstTeamInput && secondTeamInput) {
      if (!firstTeam || !secondTeam) {
        return {
          updatedAt: predictions.updatedAt,
          error: "Unknown team in matchup.",
          requested: { matchId, teamA: firstTeamInput, teamB: secondTeamInput },
          knownTeams: teams.map(({ code, name }) => ({ code, name })),
        };
      }

      return {
        updatedAt: predictions.updatedAt,
        type: "matchup",
        matchId,
        ...compareTeams(firstTeam, secondTeam),
      };
    }

    const singleTeam = teamFor(team ?? teamA);
    if (singleTeam) {
      return {
        updatedAt: predictions.updatedAt,
        type: "team",
        team: compactTeam(singleTeam),
      };
    }

    if (group) {
      return {
        updatedAt: predictions.updatedAt,
        type: "group",
        group,
        teams: groupTeams(group),
      };
    }

    return {
      updatedAt: predictions.updatedAt,
      type: "title_ranking",
      teams: topTeams(limit ?? 8),
    };
  },
});
