import {
  type Competition,
  type Competitor,
  fetchScoreboard,
  type MatchStatus,
  matchIdForEvent,
  matchStatus,
} from "@/agent/lib/espn";
import { tournamentDateTime } from "@/agent/lib/time";

// Shapes the ESPN scoreboard into the result rows the `get_match_results` tool
// returns.

export type MatchResultsFilter = {
  status?: MatchStatus;
  /** Earliest kickoff by tournament-day date (YYYY-MM-DD or YYYY-MM-DDTHH:MM). */
  from?: string;
  /** Latest kickoff by tournament-day date (YYYY-MM-DD or YYYY-MM-DDTHH:MM). */
  to?: string;
};

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

export async function loadMatchResults({
  status,
  from,
  to,
}: MatchResultsFilter) {
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
}
