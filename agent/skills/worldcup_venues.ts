import { defineSkill } from "eve/skills";

import scheduleData from "@/agent/lib/schedule";

const rows = scheduleData
  .map((match) => {
    const teamA = match.teamA ?? "TBD";
    const teamB = match.teamB ?? "TBD";
    return `${match.number} · ${match.stadium} · ${teamA} vs ${teamB}`;
  })
  .join("\n");

export default defineSkill({
  description:
    "Use when the user asks where a match is played, a match's stadium or venue, or which matches are at a given stadium or city.",
  markdown: `# World Cup 2026 Venues

The stadium for each match. Teams are FIFA 3-letter codes; 'TBD' = team not decided yet. For kickoff times and fixtures use the schedule skill.

Each line is: match number · stadium · home vs away.

## Venues
${rows}`,
});
