import { defineTool } from "eve/tools";
import { z } from "zod";

import { getGroupForecasts } from "@/agent/lib/predictions-snapshot";
import scheduleData from "@/agent/lib/schedule";
import { codeFor } from "@/agent/lib/team-aliases";
import { groupFixture } from "@/lib/tournament";

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

export default defineTool({
  description:
    "Predicted scoreline and two-way win odds for an upcoming group-stage match. Give it the two teams or the group match number (1-72).",
  inputSchema: z.object({
    matchId: z
      .number()
      .int()
      .min(1)
      .max(72)
      .optional()
      .describe("Group match number, 1-72."),
    teamA: z.string().optional().describe("First team name or code."),
    teamB: z.string().optional().describe("Second team name or code."),
  }),
  async execute({ matchId, teamA, teamB }) {
    const match = matchId
      ? scheduleData.find((m) => m.number === matchId)
      : undefined;
    if (matchId && !match) {
      return { error: "Match not found.", requested: { matchId } };
    }

    const codeA = codeFor(match?.teamA ?? teamA);
    const codeB = codeFor(match?.teamB ?? teamB);
    if (!codeA || !codeB) {
      return {
        error: "Could not resolve both teams.",
        requested: { matchId, teamA, teamB },
      };
    }

    const fixture = groupFixture(codeA, codeB);
    if (!fixture) {
      return {
        error: "Not an upcoming group match.",
        requested: { teamA: codeA, teamB: codeB },
      };
    }

    const { updatedAt, forecasts } = await getGroupForecasts();
    const forecast = forecasts[fixture.id];
    if (!forecast) {
      return {
        updatedAt,
        fixture: fixture.id,
        error:
          "No forecast available (the match may be played or has no market).",
      };
    }

    return {
      updatedAt,
      fixture: forecast.fixture,
      home: forecast.home,
      away: forecast.away,
      predictedScore: forecast.predictedScore,
      homeWinPercent:
        forecast.homeWinProbability != null
          ? percent(forecast.homeWinProbability)
          : undefined,
      awayWinPercent:
        forecast.awayWinProbability != null
          ? percent(forecast.awayWinProbability)
          : undefined,
    };
  },
});
