import { defineSkill } from "eve/skills";
import scheduleData from "@/data/schedule.json" with { type: "json" };

import {
  TOURNAMENT_DAY_ROLLOVER_UTC,
  tournamentDay,
  tournamentTime,
} from "@/lib/time";

const matches = scheduleData
  .map((m) => {
    const kickoff = new Date(m.kickoffAt);
    const a = m.teamA ?? "TBD";
    const b = m.teamB ?? "TBD";
    return `${m.number} | ${tournamentDay(kickoff)} | ${tournamentTime(kickoff)} | ${a} vs ${b} | ${m.stadium}`;
  })
  .join("\n");

export default defineSkill({
  description:
    "Use when the user asks about World Cup match numbers, fixtures, kickoff times, or which teams play.",
  markdown: `# World Cup 2026 Schedule

Use this lookup data for fixtures, kickoff times, stadiums, and team matchups. Filter by the schedule date exactly; dates roll over at ${TOURNAMENT_DAY_ROLLOVER_UTC}.
Answer naturally and include only the fields needed. Rows are: match number | date | time | teams | stadium. Team values are country codes; expand common ones when useful. 'TBD' = team not yet decided.
For live scores, status, or incidents, use the match tools instead of inferring from kickoff times.

## Matches
${matches}`,
});
