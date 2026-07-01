import { format, isValid } from "date-fns";

import type { MatchOdds } from "@/lib/predictions";
import type { MatchResult, Side } from "@/lib/results";
import { matchByNumber, type Round, teamById } from "@/lib/tournament";

// Short header label per knockout round (group matches use "Group X" instead).
const ROUND_LABEL: Record<Round, string> = {
  R32: "R32",
  R16: "R16",
  QF: "Quarter",
  SF: "Semifinal",
  TP: "3rd place",
  FINAL: "Final",
};

// Knockout matches (73–104) are labelled by round; group matches by their group.
function phaseLabel(match: MatchResult): string | undefined {
  const round = matchByNumber[match.n]?.round;
  if (round) return ROUND_LABEL[round];
  const group = teamById[match.home.code]?.group;
  return group ? `Group ${group}` : undefined;
}

const FIFA_DAY_TIME_ZONE = "America/New_York";
const fifaDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FIFA_DAY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

interface FifaDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function fifaDateTimeParts(date: Date): FifaDateTimeParts | null {
  if (!isValid(date)) return null;
  const parts = Object.fromEntries(
    fifaDayFormatter
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function fifaDayKey(date: Date): string {
  const parts = fifaDateTimeParts(date);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

function fifaDate(parts: FifaDateTimeParts): Date {
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
}

function matchFifaDayKey(match: MatchResult): string {
  if (!match.kickoff) return "";
  return fifaDayKey(new Date(match.kickoff));
}

function isMatchOnFifaDay(match: MatchResult, dayKey: string): boolean {
  return matchFifaDayKey(match) === dayKey;
}

// Kickoff shown for upcoming matches, e.g. "Jul 22, 12hs" (US FIFA day time).
function formatKickoff(iso: string): string {
  const parts = fifaDateTimeParts(new Date(iso));
  if (!parts) return "";
  return format(
    fifaDate(parts),
    parts.minute === 0 ? "MMM d, H'hs'" : "MMM d, H:mm'hs'",
  );
}

// Win odds are keyed by the unordered team pair so we can attach them to an
// ESPN match regardless of which side the feed lists as home.
function pairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function currentTeamView(side: Side) {
  return {
    code: side.code,
    name: teamById[side.code]?.name,
    score: side.score,
    winner: side.winner,
  };
}

// Orient the fixture's home/away odds to the ESPN match's home/away. Only shown
// before full time — once settled the result, not the market, is what matters.
function matchPrediction(match: MatchResult, chance?: MatchOdds) {
  if (!chance || match.status === "final") return undefined;
  return chance.home === match.home.code
    ? { homeWin: chance.homeWin, awayWin: chance.awayWin }
    : { homeWin: chance.awayWin, awayWin: chance.homeWin };
}

function currentMatchView(match: MatchResult, odds: Map<string, MatchOdds>) {
  return {
    number: match.n,
    phaseLabel: phaseLabel(match),
    status: match.status,
    detail: match.detail,
    live: match.status === "live",
    kickoffAt: match.kickoff,
    kickoff: match.kickoff ? formatKickoff(match.kickoff) : undefined,
    home: currentTeamView(match.home),
    away: currentTeamView(match.away),
    prediction: matchPrediction(
      match,
      odds.get(pairKey(match.home.code, match.away.code)),
    ),
  };
}

/** Map a set of matches to MatchWidget props with win odds attached. */
export function buildMatchViews(matches: MatchResult[], odds: MatchOdds[]) {
  const oddsByPair = new Map(odds.map((o) => [pairKey(o.home, o.away), o]));
  return matches.map((m) => currentMatchView(m, oddsByPair));
}

/** Matches currently in progress, as MatchWidget props. */
export function liveMatchViews(matches: MatchResult[], odds: MatchOdds[]) {
  return buildMatchViews(
    matches.filter((m) => m.status === "live"),
    odds,
  );
}

/** Specific matches by FIFA number as MatchWidget props, in the order asked,
 * skipping any number with no live entry. */
export function matchViewsByNumber(
  matches: MatchResult[],
  odds: MatchOdds[],
  numbers: number[],
) {
  const byNumber = new Map(matches.map((m) => [m.n, m]));
  const ordered = numbers
    .map((n) => byNumber.get(n))
    .filter((m): m is MatchResult => m != null);
  return buildMatchViews(ordered, odds);
}

/** Today's matches (US FIFA day) as MatchWidget props, kickoff-sorted, with
 * market win odds attached when available. */
export function todayMatchViews(matches: MatchResult[], odds: MatchOdds[]) {
  const todayKey = fifaDayKey(new Date());
  const oddsByPair = new Map(odds.map((o) => [pairKey(o.home, o.away), o]));
  return matches
    .filter((match) => isMatchOnFifaDay(match, todayKey))
    .sort(
      (a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? "") || a.n - b.n,
    )
    .map((m) => currentMatchView(m, oddsByPair));
}
