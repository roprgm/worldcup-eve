import { defineTool } from "eve/tools";
import { z } from "zod";

import { matchSchedule, teamById } from "@/lib/tournament";

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? code) : "TBD";

const norm = (value: string) => value.trim().toLowerCase();

const involvesTeam = (code: string | null, query: string) => {
  if (!code) return false;
  const q = norm(query);
  return norm(code) === q || norm(teamById[code]?.name ?? "").includes(q);
};

export default defineTool({
  description:
    "The stadium/venue for World Cup matches. Filter by team, match numbers, or venue to keep the answer small. The team filter covers the group stage; for where a team plays its knockout rounds use show_team_path. For kickoff times use get_match_schedule.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("Only matches involving this team (FIFA code or name)."),
    matches: z
      .array(z.number().int())
      .optional()
      .describe("Only these FIFA match numbers (1-104)."),
    venue: z
      .string()
      .optional()
      .describe("Only matches at this stadium or city (substring match)."),
  }),
  execute({ team, matches, venue }) {
    const wanted = matches && new Set(matches);
    const venueQuery = venue && norm(venue);
    const selected = matchSchedule
      .filter(
        (m) =>
          !team || involvesTeam(m.homeId, team) || involvesTeam(m.awayId, team),
      )
      .filter((m) => !wanted || wanted.has(m.number))
      .filter((m) => !venueQuery || norm(m.venue).includes(venueQuery));

    if (selected.length === 0) return "No matching matches.";

    return selected
      .map(
        (m) =>
          `Match ${m.number}: ${teamName(m.homeId)} vs ${teamName(m.awayId)} at ${m.venue}`,
      )
      .join("\n");
  },
});
