import { defineTool } from "eve/tools";
import { z } from "zod";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";
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

function scheduleLine(match: (typeof matchSchedule)[number], now: number) {
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
    "Look up match numbers, fixtures, and kickoff times as text — filter by team or match numbers. Each fixture is tagged already played / live now / upcoming relative to the current time. Use this for a team's schedule or to list many matches; to display today's or in-progress matches as cards, use show_matches instead.",
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
  execute({ team, matches }) {
    const now = Date.now();
    const wanted = matches && new Set(matches);
    const selected = [...matchSchedule]
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
    // any) live in the knockout bracket, where fixtures stay TBD until decided.
    if (team && upcomingCount === 0)
      notes.push(
        `No upcoming fixtures here for "${team}": its group stage is over. For where it goes next and its likely opponent, use show_team_path.`,
      );

    return `${notes.join("\n")}\n\n${days}`;
  },
});
