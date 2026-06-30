import { defineTool } from "eve/tools";
import { z } from "zod";

import { relativeTournamentDay, tournamentDateTime } from "@/agent/lib/time";
import { getMatchResults } from "@/lib/results";
import { matchSchedule, venueTimeZone } from "@/lib/tournament";

const venueByNumber = new Map(matchSchedule.map((m) => [m.number, m.venue]));

const tournamentDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);

function rangePoint(value: string, end = false): string {
  return value.includes("T") ? value : `${value}T${end ? "23:59" : "00:00"}`;
}

function inRange(
  kickoffAt: string | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  if (!kickoffAt) return false;
  return (
    (!from || kickoffAt >= rangePoint(from)) &&
    (!to || kickoffAt <= rangePoint(to, true))
  );
}

export default defineTool({
  description:
    "Final scores and live status for World Cup matches, including who played whom and the result. Use this for any score or result question. Filters are optional and combine.",
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
    const { matches } = await getMatchResults();
    const now = new Date();

    const results = matches
      .map((match) => {
        const kickoff = match.kickoff ? new Date(match.kickoff) : undefined;
        const venue = venueByNumber.get(match.n);
        return {
          id: match.n,
          status: match.status,
          detail: match.detail,
          day: kickoff ? relativeTournamentDay(kickoff, now) : undefined,
          kickoffAtUtc: kickoff?.toISOString(),
          tournamentKickoffAt: kickoff
            ? tournamentDateTime(kickoff)
            : undefined,
          home: match.home,
          away: match.away,
          venue,
          venueTimeZone: venue ? venueTimeZone(venue) : undefined,
        };
      })
      .filter(
        (match) =>
          (!status || match.status === status) &&
          inRange(match.tournamentKickoffAt, from, to),
      );

    return { results };
  },
});
