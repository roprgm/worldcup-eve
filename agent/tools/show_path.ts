import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  buildTeamOutlook,
  projectTeams,
  summarizeTeam,
} from "@/agent/lib/outlook";
import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import { teams } from "@/lib/tournament";

export default defineTool({
  description:
    "Display the team-path widget: a team's projected route — who it could face and where it plays, round by round. Pass the team name or code. Returns the route so you can add one short line; never spell out the route yourself.",
  inputSchema: z.object({
    team: z.string().describe("A team name or FIFA code."),
  }),
  async execute({ team }) {
    const snapshot = await getPredictions();
    const code = codeFor(team);
    const found = code ? projectTeams(snapshot).get(code) : undefined;
    return buildTeamOutlook(
      snapshot,
      found,
      teams.map((t) => t.name),
    );
  },
  toModelOutput(output) {
    if (output.kind === "team")
      return { type: "text", value: summarizeTeam(output) };
    if (output.kind === "out") return { type: "text", value: output.note };
    return {
      type: "text",
      value: `Unknown team. Known teams include: ${output.knownTeams.slice(0, 8).join(", ")}.`,
    };
  },
});
