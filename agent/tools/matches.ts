import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  involvesTeam,
  norm,
  resolvedKnockoutTeams,
  teamName,
} from "@/agent/lib/fixtures";
import { relativeTournamentDay, tournamentDay } from "@/agent/lib/time";
import { getMatchResults, type MatchResult, realTeamCode } from "@/lib/results";
import { matchSchedule, venueTimeZone } from "@/lib/tournament";

// A match is live for two hours from kickoff, then it counts as played.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

interface Fixture {
  number: number;
  homeId: string | null;
  awayId: string | null;
  kickoffAt: string;
  venue: string;
  result?: MatchResult;
}

export default defineTool({
  description:
    "World Cup fixtures and results: who plays whom, kickoff, stadium, status, final score. Any schedule, fixture, result, venue, today/live, or date-range question — including a game between two named teams. For goals, cards, and cross-match stats use query instead. ALWAYS follow with ONE `match` block; its body is ONLY match numbers, `today`, or `live` — for anything else, list this result's match numbers.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("Only matches involving this team (name or FIFA code)."),
    matches: z
      .array(z.number().int())
      .optional()
      .describe("Only these FIFA match numbers (1-104)."),
    venue: z
      .string()
      .optional()
      .describe("Only matches at this stadium or city (substring)."),
    status: z
      .enum(["scheduled", "live", "final"])
      .optional()
      .describe("Only matches in this state."),
    when: z
      .enum(["today", "next", "upcoming", "past"])
      .optional()
      .describe(
        "Only today's, the soonest future kickoff (next), still-upcoming, or already-played matches.",
      ),
    from: z
      .string()
      .optional()
      .describe("Only matches on or after this date (YYYY-MM-DD), inclusive."),
    to: z
      .string()
      .optional()
      .describe("Only matches on or before this date (YYYY-MM-DD), inclusive."),
  }),
  async execute({ team, matches, venue, status, when, from, to }) {
    const now = new Date();
    const nowMs = now.getTime();
    const results = await getMatchResults();
    const resolved = await resolvedKnockoutTeams();
    const resultByNumber = new Map<number, MatchResult>(
      results.matches.map((m) => [m.n, m]),
    );

    // Ignore out-of-range numbers (models sometimes pass a stray 0); an
    // all-invalid list means "no filter" rather than "match nothing".
    const valid = matches?.filter((n) => n >= 1 && n <= 104);
    const wanted = valid?.length ? new Set(valid) : undefined;
    const venueQuery = venue && norm(venue);
    const played = (kickoffAt: string) =>
      new Date(kickoffAt).getTime() + MATCH_WINDOW_MS <= nowMs;

    const filtered: Fixture[] = matchSchedule
      .map((m) => {
        const result = resultByNumber.get(m.number);
        return {
          number: m.number,
          homeId:
            m.homeId ??
            resolved.get(m.number)?.home ??
            realTeamCode(result?.home),
          awayId:
            m.awayId ??
            resolved.get(m.number)?.away ??
            realTeamCode(result?.away),
          kickoffAt: m.kickoffAt,
          venue: m.venue,
          result,
        };
      })
      .filter(
        (m) =>
          !team || involvesTeam(m.homeId, team) || involvesTeam(m.awayId, team),
      )
      .filter((m) => !wanted || wanted.has(m.number))
      .filter((m) => !venueQuery || norm(m.venue).includes(venueQuery))
      .filter((m) => !status || (m.result?.status ?? "scheduled") === status)
      .filter((m) => {
        if (!from && !to) return true;
        const day = tournamentDay(new Date(m.kickoffAt));
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      })
      .filter((m) => {
        if (!when) return true;
        if (when === "past") return played(m.kickoffAt);
        if (when === "upcoming") return !played(m.kickoffAt);
        if (when === "next") return new Date(m.kickoffAt).getTime() > nowMs;
        return relativeTournamentDay(new Date(m.kickoffAt), now) === "today";
      })
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

    // "next" keeps only the soonest future kickoff, which several matches can share.
    const selected =
      when === "next"
        ? filtered.filter((m) => m.kickoffAt === filtered[0]?.kickoffAt)
        : filtered;

    if (selected.length === 0) {
      const note =
        team && (when === "upcoming" || when === "next")
          ? `${team} has no scheduled fixture left — its next game is an undecided knockout slot. Show a path code block for it to trace where it goes next.`
          : "No matching matches.";
      return { matches: [], note };
    }

    const rows = selected.map((m) => {
      const state = m.result?.status ?? "scheduled";
      return {
        number: m.number,
        home: teamName(m.homeId),
        away: teamName(m.awayId),
        status: state,
        score:
          state === "scheduled"
            ? null
            : `${m.result?.home.score ?? 0}-${m.result?.away.score ?? 0}`,
        kickoff: m.kickoffAt,
        day: relativeTournamentDay(new Date(m.kickoffAt), now),
        venue: m.venue,
        venueTz: venueTimeZone(m.venue) ?? "UTC",
      };
    });

    return { matches: rows };
  },
});
