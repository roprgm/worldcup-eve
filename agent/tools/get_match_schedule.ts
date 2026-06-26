import { defineTool } from "eve/tools";
import { z } from "zod";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";
import { matchSchedule, teamById } from "@/lib/tournament";

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const norm = (value: string) => value.trim().toLowerCase();

// Match a team filter against either the FIFA code or the display name.
const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

function scheduleLine(match: (typeof matchSchedule)[number]) {
  const day = tournamentDay(new Date(match.kickoffAt));
  const utcDay = match.kickoffAt.slice(0, 10);
  const time = match.kickoffAt.slice(11, 16);
  // Only spell out the date when the kickoff lands on the next UTC day.
  const when =
    utcDay === day ? `${time} UTC` : `${utcDay.slice(5)} ${time} UTC`;
  return {
    day,
    text: `Match ${match.number}: ${teamName(match.homeId)} vs ${teamName(match.awayId)}, ${when}`,
  };
}

export default defineTool({
  description:
    "World Cup match numbers, fixtures, kickoff times, and which teams play. Filter by team or match numbers to keep the answer small.",
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
    for (const match of selected) {
      const { day, text } = scheduleLine(match);
      const lines = byDay.get(day) ?? [];
      lines.push(text);
      byDay.set(day, lines);
    }
    const days = [...byDay]
      .map(([day, lines]) => `## ${day}\n${lines.join("\n")}`)
      .join("\n\n");

    const note = `Times are UTC; convert to the user's time zone when known. A day rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}. TBD means the team isn't decided yet.`;
    return `${note}\n\n${days}`;
  },
});
