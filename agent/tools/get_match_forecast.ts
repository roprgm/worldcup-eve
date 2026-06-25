import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { getCachedPredictions } from "@/lib/cached-predictions";
import { groupFixture, groupMatches } from "@/lib/tournament";

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
      ? groupMatches.find((m) => m.number === matchId)
      : undefined;
    if (matchId && !match) {
      return { error: "Match not found.", requested: { matchId } };
    }

    const codeA = codeFor(match?.homeId ?? teamA);
    const codeB = codeFor(match?.awayId ?? teamB);
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

    const snapshot = await getCachedPredictions();
    const score = snapshot.groupScores[fixture.id];
    const odds = snapshot.matchOdds.find((o) => o.matchId === fixture.id);
    if (!score && !odds) {
      return {
        updatedAt: snapshot.updatedAt,
        fixture: fixture.id,
        error:
          "No forecast available (the match may be played or has no market).",
      };
    }

    return {
      updatedAt: snapshot.updatedAt,
      fixture: fixture.id,
      home: fixture.homeId,
      away: fixture.awayId,
      predictedScore: score ? { home: score.h, away: score.a } : undefined,
      homeWinPercent: odds ? percent(odds.homeWin) : undefined,
      awayWinPercent: odds ? percent(odds.awayWin) : undefined,
    };
  },
});
