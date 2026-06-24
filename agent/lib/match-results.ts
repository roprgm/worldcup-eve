import {
  type Competition,
  type Competitor,
  fetchScoreboard,
  type MatchStatus,
  matchIdForEvent,
  matchStatus,
} from "@/agent/lib/espn";
import { tournamentDateTime } from "@/agent/lib/time";

// Shared scoreboard-shaping logic, used by both the `get_match_results` tool
// (agent side) and the `/api/matches` route (client polling for live updates),
// so the two always return the same shape.

export type MatchResultsFilter = {
  status?: MatchStatus;
  /** Earliest kickoff by tournament-day date (YYYY-MM-DD or YYYY-MM-DDTHH:MM). */
  from?: string;
  /** Latest kickoff by tournament-day date (YYYY-MM-DD or YYYY-MM-DDTHH:MM). */
  to?: string;
  /** Restrict to specific match ids — used by the live-poll endpoint. */
  ids?: number[];
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
  ids,
}: MatchResultsFilter) {
  const scoreboard = await fetchScoreboard();
  const idSet = ids?.length ? new Set(ids) : undefined;

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
        (!idSet || idSet.has(match.id)) &&
        inRange(match.tournamentKickoffAt, from, to) &&
        (!status || matchStatus(match.status) === status),
    );

  return { results };
}
