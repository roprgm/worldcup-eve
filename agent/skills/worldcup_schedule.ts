import { defineSkill } from "eve/skills";

import scheduleData from "@/agent/lib/schedule";
import { TOURNAMENT_DAY_ROLLOVER_UTC, tournamentDay } from "@/agent/lib/time";
import { teams } from "@/lib/tournament";

// FIFA code → country name, so the agent expands codes reliably (not from memory).
const codes = teams.map((team) => `${team.id} ${team.name}`).join(" · ");

// Group matches under their tournament day, in kickoff order within each day.
const byDay = new Map<string, string[]>();
for (const match of [...scheduleData].sort((a, b) =>
  a.kickoffAt.localeCompare(b.kickoffAt),
)) {
  const day = tournamentDay(new Date(match.kickoffAt));
  const kickoff = `${match.kickoffAt.slice(0, 16)}Z`; // YYYY-MM-DDThh:mmZ
  const teamA = match.teamA ?? "TBD";
  const teamB = match.teamB ?? "TBD";
  let rows = byDay.get(day);
  if (!rows) byDay.set(day, (rows = []));
  rows.push(`${match.number} · ${kickoff} · ${teamA} vs ${teamB}`);
}

const days = [...byDay]
  .map(([day, rows]) => `## ${day}\n${rows.join("\n")}`)
  .join("\n\n");

export default defineSkill({
  description:
    "Use when the user asks about World Cup match numbers, fixtures, kickoff times, or which teams play.",
  markdown: `# World Cup 2026 Schedule

Matches grouped under their tournament day, in kickoff order. Tournament days roll over at ${TOURNAMENT_DAY_ROLLOVER_UTC}, so a kickoff after midnight UTC is listed under the previous day.
- To answer "what's on <day>", use the day heading, not the kickoff date.
- Each line is: match number · kickoff (UTC) · home vs away. Convert the UTC kickoff to the Client context timeZone when available, otherwise say UTC. Never present a day heading as a kickoff time.
- Teams are FIFA 3-letter codes — expand them with the Codes list below. 'TBD' = team not decided yet.
- For stadiums use the venues skill; for scores, status, or incidents use the match tools.

## Codes
${codes}

${days}`,
});
