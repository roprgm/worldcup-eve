import {
  involvesTeam,
  norm,
  resolvedKnockoutTeams,
  teamName,
} from "@/agent/lib/fixtures";
import { relativeTournamentDay, tournamentDay } from "@/agent/lib/time";
import { getMatchResults, type MatchResult } from "@/lib/results";
import { matchSchedule, teamById, venueTimeZone } from "@/lib/tournament";

// Shared fixture query. Both the `matches` data tool and the `show_match` widget
// tool read from here, so a card and a prose answer agree on the same rows.

// A match is live for two hours from kickoff, then it counts as played.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

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

export interface FixtureFilters {
  team?: string;
  matches?: number[];
  venue?: string;
  status?: "scheduled" | "live" | "final";
  when?: "today" | "next" | "upcoming" | "past";
  from?: string;
  to?: string;
}

export interface FixtureRow {
  number: number;
  home: string;
  away: string;
  status: "scheduled" | "live" | "final";
  score: string | null;
  kickoff: string;
  day: string;
  venue: string;
  venueTz: string;
}

export async function queryFixtures(
  filters: FixtureFilters,
): Promise<{ matches: FixtureRow[]; note?: string }> {
  const { team, matches, venue, status, when, from, to } = filters;
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
        ? `${team} has no scheduled fixture left — its next game is an undecided knockout slot. Call show_path for it to trace where it goes next.`
        : "No matching matches.";
    return { matches: [], note };
  }

  const rows: FixtureRow[] = selected.map((m) => {
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
}

export function summarizeFixtures(rows: FixtureRow[]): string {
  if (rows.length === 0) return "No matching matches.";
  const line = (m: FixtureRow) => {
    const head = `#${m.number} ${m.home} vs ${m.away}`;
    if (m.status === "final") return `${head} — final ${m.score}`;
    if (m.status === "live") return `${head} — live ${m.score}`;
    return `${head} — ${m.day}`;
  };
  return rows.map(line).join("; ") + ".";
}
