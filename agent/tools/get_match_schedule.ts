import { defineTool } from "eve/tools";
import { z } from "zod";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";
import { getMatchResults } from "@/lib/results";
import { matchSchedule, teamById } from "@/lib/tournament";

// A match counts as live for two hours from kickoff, then it is played.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

type Status = "played" | "live" | "upcoming";

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const norm = (value: string) => value.trim().toLowerCase();

// Match a team filter against either the FIFA code or the display name.
const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

// Knockout slots are TBD in the static schedule; the results feed names them
// once the bracket fills (a real FIFA code, or a slot like "2A" we ignore).
async function resolvedKnockoutTeams(): Promise<
  Map<number, { home: string | null; away: string | null }>
> {
  const resolved = new Map<
    number,
    { home: string | null; away: string | null }
  >();
  try {
    const { matches } = await getMatchResults();
    for (const m of matches) {
      if (m.n <= 72) continue;
      const home = teamById[m.home.code] ? m.home.code : null;
      const away = teamById[m.away.code] ? m.away.code : null;
      if (home || away) resolved.set(m.n, { home, away });
    }
  } catch {
    // Results feed unavailable — fall back to the static TBD slots.
  }
  return resolved;
}

function matchStatus(kickoffAt: string, now: number): Status {
  const kickoff = new Date(kickoffAt).getTime();
  if (kickoff + MATCH_WINDOW_MS <= now) return "played";
  if (kickoff <= now) return "live";
  return "upcoming";
}

const STATUS_LABEL: Record<Status, string> = {
  played: "already played",
  live: "live now",
  upcoming: "upcoming",
};

interface EffectiveMatch {
  number: number;
  homeId: string | null;
  awayId: string | null;
  kickoffAt: string;
}

function scheduleLine(match: EffectiveMatch, now: number) {
  const day = tournamentDay(new Date(match.kickoffAt));
  const utcDay = match.kickoffAt.slice(0, 10);
  const time = match.kickoffAt.slice(11, 16);
  // Only spell out the date when the kickoff lands on the next UTC day.
  const when =
    utcDay === day ? `${time} UTC` : `${utcDay.slice(5)} ${time} UTC`;
  const status = matchStatus(match.kickoffAt, now);
  return {
    day,
    status,
    text: `Match ${match.number}: ${teamName(match.homeId)} vs ${teamName(match.awayId)}, ${when} — ${STATUS_LABEL[status]}`,
  };
}

export default defineTool({
  description:
    "Look up match numbers, fixtures, and kickoff times as text — filter by team or match numbers. Each fixture is tagged already played / live now / upcoming relative to the current time, and decided knockout matchups show the real teams (TBD only while still undecided). Use this for a team's schedule or to list many matches; to display today's or in-progress matches as cards, use show_matches instead.",
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
    const wanted = matches && new Set(matches);

    const selected: EffectiveMatch[] = matchSchedule
      .map((m) => ({
        number: m.number,
        homeId: m.homeId ?? resolved.get(m.number)?.home ?? null,
        awayId: m.awayId ?? resolved.get(m.number)?.away ?? null,
        kickoffAt: m.kickoffAt,
      }))
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
      .filter(
        (m) =>
          !team || involvesTeam(m.homeId, team) || involvesTeam(m.awayId, team),
      )
      .filter((m) => !wanted || wanted.has(m.number));

    if (selected.length === 0) return "No matching matches.";

    const byDay = new Map<string, string[]>();
    let upcomingCount = 0;
    for (const match of selected) {
      const { day, status, text } = scheduleLine(match, now);
      if (status !== "played") upcomingCount += 1;
      const lines = byDay.get(day) ?? [];
      lines.push(text);
      byDay.set(day, lines);
    }
    const days = [...byDay]
      .map(([day, lines]) => `## ${day}\n${lines.join("\n")}`)
      .join("\n\n");

    const notes = [
      `Today is tournament day ${tournamentDay(new Date(now))}. Each fixture is tagged already played / live now / upcoming — lead with what's still to come and never present a played match as upcoming.`,
      "Times are UTC; convert to the user's time zone when known. A day rolls over at " +
        `${TOURNAMENT_DAY_ROLLOVER_UTC}. TBD means the team isn't decided yet.`,
    ];
    // When a team filter returns only finished fixtures, its remaining games (if
    // any) live in the knockout bracket — undecided ones don't surface here yet.
    if (team && upcomingCount === 0)
      notes.push(
        `No upcoming fixtures here for "${team}": its group stage is over and its next knockout opponent isn't decided yet. For where it goes next and its likely opponent, use show_team_path.`,
      );

    return `${notes.join("\n")}\n\n${days}`;
  },
});
