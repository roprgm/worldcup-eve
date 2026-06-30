import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { captionOutput } from "@/agent/lib/tool-output";
import { getPredictions, type Predictions } from "@/lib/predictions";
import { getMatchResults, type Results } from "@/lib/results";
import {
  groupFixture,
  groupMatches,
  knockoutMatches,
  matchByNumber,
  matchSchedule,
  type Round,
  type SlotRef,
  teamById,
  venueTimeZone,
} from "@/lib/tournament";
import {
  relativeTournamentDay,
  tournamentDateTime,
} from "@/lib/tournament/day";

// A match counts as played 2h after kickoff for "upcoming"/"played" scope —
// independent of the live feed, which can lag right at kickoff.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_RESULTS = 20;
const CANDIDATE_LIMIT = 6;

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third-place play-off",
  FINAL: "Final",
};

const teamName = (code: string) => teamById[code]?.name ?? code;
const percent = (p: number) => Math.round(p * 1000) / 10;
const norm = (value: string) => value.trim().toLowerCase();
const isRealCode = (code: string | undefined): code is string =>
  Boolean(code && teamById[code]);
const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

interface TeamSlot {
  code?: string;
  name?: string;
  score?: number;
  candidates?: { team: string; chancePercent: number }[];
}
interface MatchForecast {
  predictedScore?: { home: number; away: number };
  homeWinPercent?: number;
  awayWinPercent?: number;
  hypothetical?: boolean;
}
interface MatchEntry {
  number?: number; // absent only for a hypothetical (undrawn) pairing
  round?: string;
  state: "scheduled" | "live" | "played" | "undecided" | "hypothetical";
  day?: string;
  kickoffAtUtc?: string;
  venue?: string;
  venueTimeZone?: string;
  detail?: string;
  home: TeamSlot;
  away: TeamSlot;
  forecast?: MatchForecast;
}

const tournamentDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);
const matchId = z.number().int().min(1).max(104);

// Knockout fixtures are TBD in the static schedule. Resolve them from the real
// results first (settled group order + assigned third slots), then fall back
// to prediction slots for anything not yet decided, so a team's next knockout
// game shows up by name as soon as it's known — even before ESPN's own feed
// catches up.
async function resolvedKnockoutTeams(
  results: Results,
  predictions: Predictions,
): Promise<Map<number, { home: string | null; away: string | null }>> {
  const resolved = new Map<
    number,
    { home: string | null; away: string | null }
  >();
  const set = (match: number, side: "home" | "away", code: string | null) => {
    if (!code) return;
    const sides = resolved.get(match) ?? { home: null, away: null };
    sides[side] = code;
    resolved.set(match, sides);
  };

  const thirdByMatch = new Map(
    results.thirdSlots.map((t) => [t.match, t.teamId]),
  );
  const fromResults = (ref: SlotRef, match: number): string | null => {
    if (ref.kind === "winner")
      return results.settledGroupOrder[ref.group]?.[0] ?? null;
    if (ref.kind === "runner")
      return results.settledGroupOrder[ref.group]?.[1] ?? null;
    if (ref.kind === "third") return thirdByMatch.get(match) ?? null;
    return null; // match/loser refs resolve from predictions below
  };
  for (const m of knockoutMatches) {
    set(m.number, "home", fromResults(m.home, m.number));
    set(m.number, "away", fromResults(m.away, m.number));
  }

  const settled = (match: number, side: "home" | "away") => {
    const top = predictions.slots.find(
      (s) => s.match === match && s.side === side,
    )?.candidates[0];
    return top && top.probability >= 0.99 ? top.code : null;
  };
  for (const m of knockoutMatches) {
    const sides = resolved.get(m.number);
    if (!sides?.home) set(m.number, "home", settled(m.number, "home"));
    if (!sides?.away) set(m.number, "away", settled(m.number, "away"));
  }

  return resolved;
}

function candidatesFor(
  predictions: Predictions,
  match: number,
  side: "home" | "away",
) {
  const candidates =
    predictions.slots.find((s) => s.match === match && s.side === side)
      ?.candidates ?? [];
  return candidates
    .filter((c) => c.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, CANDIDATE_LIMIT)
    .map((c) => ({
      team: teamName(c.code),
      chancePercent: percent(c.probability),
    }));
}

// Predicted scoreline + win odds for a not-yet-final match: the group fixture
// market for 1-72, the knockout match's market (per-game, once decided) for
// 73-104. Once a match is final the result speaks for itself, not the market.
function forecastFor(
  predictions: Predictions,
  number: number,
  homeId: string,
  awayId: string,
): MatchForecast | undefined {
  if (number <= 72) {
    const fixture = groupMatches.find((m) => m.number === number);
    if (!fixture) return undefined;
    const score = predictions.groupScores[fixture.id];
    const odds = predictions.matchOdds.find((o) => o.matchId === fixture.id);
    if (!score && !odds) return undefined;
    return {
      predictedScore: score ? { home: score.h, away: score.a } : undefined,
      homeWinPercent: odds ? percent(odds.homeWin) : undefined,
      awayWinPercent: odds ? percent(odds.awayWin) : undefined,
    };
  }

  const byCode = new Map(
    (predictions.matchWinOdds[number] ?? []).map((c) => [
      c.code,
      c.probability,
    ]),
  );
  const home = byCode.get(homeId) ?? 0;
  const away = byCode.get(awayId) ?? 0;
  const total = home + away;
  const score = predictions.knockoutScores[number];
  if (total <= 0 && !score) return undefined;
  return {
    predictedScore: score ? { home: score.h, away: score.a } : undefined,
    homeWinPercent: total > 0 ? percent(home / total) : undefined,
    awayWinPercent: total > 0 ? percent(away / total) : undefined,
  };
}

// A neutral-site estimate from the fitted Bradley-Terry strengths — for two
// teams that haven't (or won't) actually be drawn together. P(A beats B) =
// s_A / (s_A + s_B). Weaker than a priced market, so always flagged.
function hypotheticalEntry(
  predictions: Predictions,
  codeA: string,
  codeB: string,
): MatchEntry | undefined {
  const a = predictions.teamStrengths[codeA];
  const b = predictions.teamStrengths[codeB];
  const total = (a ?? 0) + (b ?? 0);
  if (a == null || b == null || total <= 0) return undefined;
  return {
    state: "hypothetical",
    home: { code: codeA, name: teamName(codeA) },
    away: { code: codeB, name: teamName(codeB) },
    forecast: {
      homeWinPercent: percent(a / total),
      awayWinPercent: percent(b / total),
      hypothetical: true,
    },
  };
}

function buildEntry(
  number: number,
  results: Results,
  predictions: Predictions,
  resolved: Map<number, { home: string | null; away: string | null }>,
  now: Date,
): MatchEntry {
  const sched = matchSchedule.find((m) => m.number === number);
  const bracket = matchByNumber[number];
  const live = results.matches.find((m) => m.n === number);
  const groupLetter = groupMatches.find((m) => m.number === number)?.group;
  const kickoffAt = sched?.kickoffAt;
  const venue = sched?.venue;

  const base = {
    number,
    round: bracket
      ? ROUND_LABEL[bracket.round]
      : groupLetter && `Group ${groupLetter}`,
    day: kickoffAt
      ? relativeTournamentDay(new Date(kickoffAt), now)
      : undefined,
    kickoffAtUtc: kickoffAt,
    venue,
    venueTimeZone: venue ? venueTimeZone(venue) : undefined,
  };

  // Decided: either ESPN's own feed already carries real team codes (true for
  // every group match from day one, and for a knockout match once it's live or
  // later), or our own settled-results/predictions resolution got there first.
  const homeReal = isRealCode(live?.home.code);
  const awayReal = isRealCode(live?.away.code);
  const homeId = homeReal
    ? (live?.home.code as string)
    : resolved.get(number)?.home;
  const awayId = awayReal
    ? (live?.away.code as string)
    : resolved.get(number)?.away;

  if (!homeId || !awayId) {
    return {
      ...base,
      state: "undecided",
      home: { candidates: candidatesFor(predictions, number, "home") },
      away: { candidates: candidatesFor(predictions, number, "away") },
    };
  }

  const status = homeReal && awayReal ? live?.status : undefined;
  const state: MatchEntry["state"] =
    status === "final" ? "played" : status === "live" ? "live" : "scheduled";
  const score =
    status && status !== "scheduled"
      ? {
          home: (live?.home.score ?? 0) as number,
          away: (live?.away.score ?? 0) as number,
        }
      : undefined;

  return {
    ...base,
    state,
    detail: live?.detail,
    home: { code: homeId, name: teamName(homeId), score: score?.home },
    away: { code: awayId, name: teamName(awayId), score: score?.away },
    forecast:
      state === "played"
        ? undefined
        : forecastFor(predictions, number, homeId, awayId),
  };
}

function captionFor(entry: MatchEntry): string {
  const home = entry.home.name ?? entry.home.candidates?.[0]?.team ?? "TBD";
  const away = entry.away.name ?? entry.away.candidates?.[0]?.team ?? "TBD";
  if (entry.state === "played" || entry.state === "live") {
    return `${home} ${entry.home.score ?? 0}-${entry.away.score ?? 0} ${away}${entry.detail ? ` (${entry.detail})` : ""}.`;
  }
  if (entry.state === "undecided") {
    return `Match ${entry.number}: ${entry.round} — not decided yet, top candidates ${home} vs ${away}.`;
  }
  if (entry.state === "hypothetical") {
    return `Hypothetical (not drawn together): ${home} ${entry.forecast?.homeWinPercent ?? "?"}% vs ${away} ${entry.forecast?.awayWinPercent ?? "?"}%.`;
  }
  const odds = entry.forecast
    ? ` — ${home} ${entry.forecast.homeWinPercent ?? "?"}% / ${away} ${entry.forecast.awayWinPercent ?? "?"}%`
    : "";
  return `Match ${entry.number}: ${home} vs ${away}, ${entry.day} at ${entry.venue}${odds}.`;
}

function render(
  output: { matches: MatchEntry[]; truncated?: boolean } | { error: string },
): string {
  if (!("matches" in output)) return output.error;
  if (output.matches.length === 0) return "No matching matches.";
  if (output.matches.length === 1) return captionFor(output.matches[0]);
  const lines = output.matches.slice(0, 8).map(captionFor);
  const more =
    output.matches.length > 8 ? ` (+${output.matches.length - 8} more)` : "";
  const truncated = output.truncated
    ? " Showing the soonest matches only — narrow with team/id/dates for the rest."
    : "";
  return `${output.matches.length} matches.${truncated}\n${lines.join("\n")}${more}`;
}

export default defineTool({
  description:
    "Everything about one or more World Cup matches in one call: kickoff, venue, status, score if played, predicted score/odds if not, or — for an undecided knockout slot — the candidate teams and their chances. Always shows the match card(s). Identify matches by `id` (FIFA number 1-104), `team` (that team's matches, past and upcoming), `team`+`opponent` (one pairing's odds, even hypothetical ones never drawn together), `scope` (today/live/upcoming/played), a `from`/`to` date range, or `venue`. Filters combine. Give at least one.",
  inputSchema: z.object({
    id: z
      .union([matchId, z.array(matchId)])
      .optional()
      .describe("FIFA match number(s), 1-104."),
    team: z
      .string()
      .optional()
      .describe("A team's matches, by name or code, e.g. Argentina or ARG."),
    opponent: z
      .string()
      .optional()
      .describe(
        "With `team`, one specific pairing's odds — works even for two teams that haven't been drawn together.",
      ),
    scope: z
      .enum(["today", "live", "upcoming", "played"])
      .optional()
      .describe("Filter by timing. Combines with `team`."),
    from: tournamentDate
      .optional()
      .describe("Earliest kickoff, as YYYY-MM-DD or YYYY-MM-DDTHH:MM."),
    to: tournamentDate
      .optional()
      .describe("Latest kickoff, as YYYY-MM-DD or YYYY-MM-DDTHH:MM."),
    venue: z
      .string()
      .optional()
      .describe("Only matches at this stadium or city (substring match)."),
  }),
  async execute({ id, team, opponent, scope, from, to, venue }) {
    if (!id && !team && !scope && !venue && !from && !to) {
      return {
        error:
          "Pass at least one of id, team, scope, venue, or from/to to know which match(es) you mean.",
      };
    }

    const [results, predictions] = await Promise.all([
      getMatchResults(),
      getPredictions(),
    ]);
    const resolved = await resolvedKnockoutTeams(results, predictions);
    const now = new Date();

    // A specific pairing: try a real fixture first (group, then a decided
    // knockout matchup), and only then fall back to a hypothetical estimate.
    if (team && opponent) {
      const codeA = codeFor(team);
      const codeB = codeFor(opponent);
      if (!codeA || !codeB) {
        return {
          error: "Could not resolve both teams.",
          requested: { team, opponent },
        };
      }
      const fixture = groupFixture(codeA, codeB);
      const knockoutNumber = fixture
        ? undefined
        : knockoutMatches.find((m) => {
            const sides = resolved.get(m.number);
            return (
              sides?.home &&
              sides?.away &&
              ((sides.home === codeA && sides.away === codeB) ||
                (sides.home === codeB && sides.away === codeA))
            );
          })?.number;
      const number = fixture?.number ?? knockoutNumber;
      if (number) {
        const matches = [
          buildEntry(number, results, predictions, resolved, now),
        ];
        return { matches };
      }
      const hypothetical = hypotheticalEntry(predictions, codeA, codeB);
      if (!hypothetical) {
        return {
          error: "No forecast available — couldn't resolve both teams.",
          requested: { team, opponent },
        };
      }
      return { matches: [hypothetical] };
    }

    const ids = id == null ? undefined : Array.isArray(id) ? id : [id];
    const wantedIds = ids?.length ? new Set(ids) : undefined; // an all-invalid list already can't reach here (zod bounds 1-104)
    const venueQuery = venue && norm(venue);

    const candidateNumbers = matchSchedule
      .filter((m) => !wantedIds || wantedIds.has(m.number))
      .filter((m) => {
        if (!team) return true;
        const homeId = m.homeId ?? resolved.get(m.number)?.home ?? null;
        const awayId = m.awayId ?? resolved.get(m.number)?.away ?? null;
        return involvesTeam(homeId, team) || involvesTeam(awayId, team);
      })
      .filter((m) => !venueQuery || norm(m.venue).includes(venueQuery))
      .filter((m) => {
        if (!from && !to) return true;
        const dt = tournamentDateTime(new Date(m.kickoffAt));
        const rangeStart = from && !from.includes("T") ? `${from}T00:00` : from;
        const rangeEnd = to && !to.includes("T") ? `${to}T23:59` : to;
        return (
          (!rangeStart || dt >= rangeStart) && (!rangeEnd || dt <= rangeEnd)
        );
      })
      .filter((m) => {
        if (!scope) return true;
        const kickoff = new Date(m.kickoffAt);
        if (scope === "today")
          return relativeTournamentDay(kickoff, now) === "today";
        if (scope === "live")
          return (
            results.matches.find((r) => r.n === m.number)?.status === "live"
          );
        const played = kickoff.getTime() + MATCH_WINDOW_MS <= now.getTime();
        return scope === "played" ? played : !played;
      })
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
      .map((m) => m.number);

    if (candidateNumbers.length === 0) return { matches: [] };

    const truncated = candidateNumbers.length > MAX_RESULTS;
    const matches = candidateNumbers
      .slice(0, MAX_RESULTS)
      .map((n) => buildEntry(n, results, predictions, resolved, now));

    return { matches, truncated };
  },
  toModelOutput: (output) => captionOutput(output, render),
});
