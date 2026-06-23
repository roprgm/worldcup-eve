import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  fetchScoreboard,
  matchIdForEvent,
  matchStatus,
  type Competitor,
  type Competition,
} from "@/agent/lib/espn";
import { tournamentDateTime } from "@/agent/lib/time";

const tournamentDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);

function rangePoint(value: string, end = false): string {
  return value.includes("T") ? value : `${value}T${end ? "23:59" : "00:00"}`;
}

function inRange(kickoffAt: string, from?: string, to?: string): boolean {
  return (
    (!from || kickoffAt >= rangePoint(from)) &&
    (!to || kickoffAt <= rangePoint(to, true))
  );
}

function compactCompetitor({ homeAway, winner, score, team }: Competitor) {
  return {
    homeAway,
    winner,
    score,
    team: {
      abbreviation: team.abbreviation,
      displayName: team.displayName,
    },
  };
}

function compactCompetition({ competitors }: Competition) {
  return { competitors: competitors.map(compactCompetitor) };
}

export default defineTool({
  description:
    "Scores and live status for World Cup matches. Filters are optional and combine.",
  inputSchema: z.object({
    status: z
      .enum(["scheduled", "live", "final"])
      .optional()
      .describe("Filter by match state."),
    from: tournamentDate
      .optional()
      .describe(
        "Earliest kickoff by tournament-day date, as YYYY-MM-DD or YYYY-MM-DDTHH:MM.",
      ),
    to: tournamentDate
      .optional()
      .describe(
        "Latest kickoff by tournament-day date, as YYYY-MM-DD or YYYY-MM-DDTHH:MM.",
      ),
  }),
  async execute({ status, from, to }) {
    const scoreboard = await fetchScoreboard();

    const results = scoreboard.events
      .map((event) => {
        const kickoff = new Date(event.date);
        return {
          id: matchIdForEvent(event.id),
          kickoffAtUtc: kickoff.toISOString(),
          tournamentKickoffAt: tournamentDateTime(kickoff),
          status: event.status,
          competitions: event.competitions.map(compactCompetition),
        };
      })
      .filter(
        (match) =>
          match.id !== undefined &&
          inRange(match.tournamentKickoffAt, from, to) &&
          (!status || matchStatus(match.status) === status),
      );

    return { results };
  },
});
