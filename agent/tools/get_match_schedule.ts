import { defineTool } from "eve/tools";
import { z } from "zod";

import { relativeTournamentDay, tournamentDay } from "@/agent/lib/time";
import { getPredictions } from "@/lib/predictions";
import { getMatchResults } from "@/lib/results";
import {
  knockoutMatches,
  matchSchedule,
  type SlotRef,
  teamById,
  venueTimeZone,
} from "@/lib/tournament";

// A match is live for two hours from kickoff, then it counts as played.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
// A knockout slot is "decided" once its leading team is all but certain.
const SETTLED = 0.99;

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const norm = (value: string) => value.trim().toLowerCase();

const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

type Side = "home" | "away";
type ResolvedSides = { home: string | null; away: string | null };

// Knockout fixtures are TBD in the static schedule. Resolve them from the real
// results first (settled group order + assigned third slots), then fall back to
// prediction slots for anything not yet decided, so a team's next knockout game
// shows up by name as soon as it's known.
async function resolvedKnockoutTeams(): Promise<Map<number, ResolvedSides>> {
  const resolved = new Map<number, ResolvedSides>();
  const set = (match: number, side: Side, code: string | null) => {
    if (!code) return;
    const sides = resolved.get(match) ?? { home: null, away: null };
    sides[side] = code;
    resolved.set(match, sides);
  };

  try {
    const { settledGroupOrder, thirdSlots } = await getMatchResults();
    const thirdByMatch = new Map(thirdSlots.map((t) => [t.match, t.teamId]));
    const fromResults = (ref: SlotRef, match: number): string | null => {
      if (ref.kind === "winner")
        return settledGroupOrder[ref.group]?.[0] ?? null;
      if (ref.kind === "runner")
        return settledGroupOrder[ref.group]?.[1] ?? null;
      if (ref.kind === "third") return thirdByMatch.get(match) ?? null;
      return null; // match/loser refs resolve from predictions below
    };
    for (const m of knockoutMatches) {
      set(m.number, "home", fromResults(m.home, m.number));
      set(m.number, "away", fromResults(m.away, m.number));
    }
  } catch {
    // Results unavailable — predictions still fill in below.
  }

  try {
    const { slots } = await getPredictions();
    const settled = (match: number, side: Side) => {
      const top = slots.find((s) => s.match === match && s.side === side)
        ?.candidates[0];
      return top && top.probability >= SETTLED ? top.code : null;
    };
    for (const m of matchSchedule) {
      if (m.number <= 72) continue;
      const sides = resolved.get(m.number);
      if (!sides?.home) set(m.number, "home", settled(m.number, "home"));
      if (!sides?.away) set(m.number, "away", settled(m.number, "away"));
    }
  } catch {
    // Predictions unavailable — keep whatever the results gave us.
  }

  return resolved;
}

interface Fixture {
  number: number;
  homeId: string | null;
  awayId: string | null;
  kickoffAt: string;
  venue: string;
}

function line(m: Fixture, now: Date): string {
  const day = relativeTournamentDay(new Date(m.kickoffAt), now);
  const venueTz = venueTimeZone(m.venue) ?? "UTC";
  return `Match ${m.number}: ${teamName(m.homeId)} vs ${teamName(m.awayId)} — day ${day}, kickoff_iso ${m.kickoffAt}, ${m.venue} (venue_tz ${venueTz})`;
}

export default defineTool({
  description:
    "Match fixtures as text — kickoff times, venues and match numbers, filtered by team or match number. Splits into upcoming and already-played; use it for a team's schedule or to look up a fixture's number/kickoff. To show match cards instead, use show_matches.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("Only matches involving this team (FIFA code or name)."),
    matches: z
      .array(z.number().int())
      .optional()
      .describe("Only these FIFA match numbers (1-104)."),
  }),
  async execute({ team, matches }) {
    const now = Date.now();
    const resolved = await resolvedKnockoutTeams();
    // Ignore out-of-range match numbers (models sometimes pass a stray 0); an
    // all-invalid list means "no match filter" rather than "match nothing".
    const valid = matches?.filter((n) => n >= 1 && n <= 104);
    const wanted = valid?.length ? new Set(valid) : undefined;

    const selected: Fixture[] = matchSchedule
      .map((m) => ({
        number: m.number,
        homeId: m.homeId ?? resolved.get(m.number)?.home ?? null,
        awayId: m.awayId ?? resolved.get(m.number)?.away ?? null,
        kickoffAt: m.kickoffAt,
        venue: m.venue,
      }))
      .filter(
        (m) =>
          !team || involvesTeam(m.homeId, team) || involvesTeam(m.awayId, team),
      )
      .filter((m) => !wanted || wanted.has(m.number))
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

    if (selected.length === 0) return "No matching matches.";

    const played = (m: Fixture) =>
      new Date(m.kickoffAt).getTime() + MATCH_WINDOW_MS <= now;
    const upcoming = selected.filter((m) => !played(m));
    const finished = selected.filter(played);

    const nowDate = new Date(now);
    const today = tournamentDay(nowDate);
    const fmt = (list: Fixture[]) =>
      list.length ? list.map((m) => line(m, nowDate)).join("\n") : "none";
    const out = [
      `Today is ${today}. Each match's "day" is given relative to today — base any today/tomorrow statement on that, never on the kickoff_iso (it is UTC and may show a different calendar date). Put kickoff_iso in a <local-time> tag for the time. Answer "when does it play" from the upcoming list; only mention played matches if asked about the past.`,
      "",
      `## Upcoming\n${fmt(upcoming)}`,
      `## Already played\n${fmt(finished)}`,
    ];
    if (team && upcoming.length === 0)
      out.push(
        `\n${team} has no scheduled fixture left — its next game is a knockout slot that isn't decided yet. Use show_team_path for where it goes next.`,
      );

    return out.join("\n");
  },
});
