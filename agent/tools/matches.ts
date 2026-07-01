import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  involvesTeam,
  norm,
  resolvedKnockoutTeams,
  teamName,
} from "@/agent/lib/fixtures";
import { relativeTournamentDay } from "@/agent/lib/time";
import { getMatchResults, type MatchResult } from "@/lib/results";
import { buildMatchDetail } from "@/lib/results/match-detail";
import { matchSchedule, teamById, venueTimeZone } from "@/lib/tournament";

// A match is live for two hours from kickoff, then it counts as played.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
// Cap how many incident timelines we fetch (one ESPN call each).
const MAX_TIMELINES = 4;

const isTeam = (code: string | undefined): code is string =>
  Boolean(code && teamById[code]);

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
    "World Cup fixtures, past or future: who plays whom, kickoff time, stadium, status and final score. Use it for a team's schedule, a single fixture, a result, what's on today or live, or — with timeline:true — a match's goals and cards. To put match cards on screen, also write a <match> tag.",
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
      .enum(["today", "upcoming", "past"])
      .optional()
      .describe("Only today's, still-upcoming, or already-played matches."),
    timeline: z
      .boolean()
      .optional()
      .describe(
        "Include the goals/cards/subs timeline (for incident questions).",
      ),
  }),
  async execute({ team, matches, venue, status, when, timeline }) {
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

    const selected: Fixture[] = matchSchedule
      .map((m) => {
        const result = resultByNumber.get(m.number);
        const resultCode = (side: "home" | "away") =>
          isTeam(result?.[side].code) ? result?.[side].code : undefined;
        return {
          number: m.number,
          homeId:
            m.homeId ??
            resolved.get(m.number)?.home ??
            resultCode("home") ??
            null,
          awayId:
            m.awayId ??
            resolved.get(m.number)?.away ??
            resultCode("away") ??
            null,
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
        if (!when) return true;
        if (when === "past") return played(m.kickoffAt);
        if (when === "upcoming") return !played(m.kickoffAt);
        return relativeTournamentDay(new Date(m.kickoffAt), now) === "today";
      })
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

    if (selected.length === 0) {
      const note =
        team && when === "upcoming"
          ? `${team} has no scheduled fixture left — its next game is an undecided knockout slot. Show <path team="${team}" /> for where it goes next.`
          : "No matching matches.";
      return { matches: [], note };
    }

    const timelineByNumber = new Map<number, unknown>();
    if (timeline) {
      const targets = selected
        .filter((m) => (m.result?.status ?? "scheduled") !== "scheduled")
        .slice(0, MAX_TIMELINES);
      await Promise.all(
        targets.map(async (m) => {
          try {
            timelineByNumber.set(
              m.number,
              (await buildMatchDetail(m.number)).events,
            );
          } catch {
            // Leave the match without a timeline if the detail feed fails.
          }
        }),
      );
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
        timeline: timelineByNumber.get(m.number),
      };
    });

    return { matches: rows };
  },
});
