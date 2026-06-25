import { defineSkill } from "eve/skills";

import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";
import { matchSchedule, teamById } from "@/lib/tournament";

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

// Group matches under their tournament day, in kickoff order within each day.
const byDay = new Map<string, string[]>();
for (const match of [...matchSchedule].sort((a, b) =>
  a.kickoffAt.localeCompare(b.kickoffAt),
)) {
  const day = tournamentDay(new Date(match.kickoffAt));
  const utcDay = match.kickoffAt.slice(0, 10);
  const time = match.kickoffAt.slice(11, 16);
  // Only spell out the date when the kickoff lands on the next UTC day.
  const when =
    utcDay === day ? `${time} UTC` : `${utcDay.slice(5)} ${time} UTC`;
  const line = `Match ${match.number}: ${teamName(match.homeId)} vs ${teamName(match.awayId)}, ${when}`;
  const lines = byDay.get(day) ?? [];
  lines.push(line);
  byDay.set(day, lines);
}

const days = [...byDay]
  .map(([day, lines]) => `## ${day}\n${lines.join("\n")}`)
  .join("\n\n");

export default defineSkill({
  description:
    "Use when the user asks about World Cup match numbers, fixtures, kickoff times, or which teams play.",
  markdown: `# World Cup 2026 Schedule

Matches by day, in kickoff order. A day rolls over at ${TOURNAMENT_DAY_ROLLOVER_UTC}, so a kickoff after midnight appears under the previous day with its real UTC date. Times are UTC — convert to the user's time zone when it is known. TBD means the team isn't decided yet.

${days}`,
});
