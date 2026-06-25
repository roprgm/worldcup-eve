import { defineSkill } from "eve/skills";

import { matchSchedule, teamById } from "@/lib/tournament";

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const rows = matchSchedule
  .map(
    (match) =>
      `Match ${match.number}: ${teamName(match.homeId)} vs ${teamName(match.awayId)} at ${match.venue}`,
  )
  .join("\n");

export default defineSkill({
  description:
    "Use when the user asks where a match is played, a match's stadium or venue, or which matches are at a given stadium or city.",
  markdown: `# World Cup 2026 Venues

The stadium for each match. For kickoff times and fixtures use the schedule skill.

${rows}`,
});
