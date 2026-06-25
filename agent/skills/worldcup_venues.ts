import { defineSkill } from "eve/skills";

import scheduleData from "@/agent/lib/schedule";
import { teamById } from "@/lib/tournament";

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const rows = scheduleData
  .map(
    (match) =>
      `Match ${match.number}: ${teamName(match.teamA)} vs ${teamName(match.teamB)} at ${match.stadium}`,
  )
  .join("\n");

export default defineSkill({
  description:
    "Use when the user asks where a match is played, a match's stadium or venue, or which matches are at a given stadium or city.",
  markdown: `# World Cup 2026 Venues

The stadium for each match. For kickoff times and fixtures use the schedule skill.

${rows}`,
});
