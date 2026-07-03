import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  buildFavorites,
  projectTeams,
  summarizeChances,
  summarizeFavorites,
  type TeamOdds,
} from "@/agent/lib/outlook";
import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";

export default defineTool({
  description:
    'Display the road-to-the-final chances widget: how far teams go, round by round, with title odds. Pass `teams` to pin a list, or `top` for the N title favorites (a bare "who will win?" means the title — use top). Returns each team\'s chances so you can add one short line; lead with the headline (contender, dark horse), never a wall of percentages.',
  inputSchema: z
    .object({
      teams: z
        .array(z.string())
        .optional()
        .describe("Team names or codes to pin in the table."),
      top: z
        .number()
        .int()
        .min(1)
        .max(24)
        .optional()
        .describe("Show the N title favorites instead of a pinned list."),
    })
    .refine((v) => v.top != null || (v.teams && v.teams.length > 0), {
      message: "Pass teams or top.",
    }),
  async execute({ teams, top }) {
    const snapshot = await getPredictions();
    if (teams && teams.length > 0) {
      const projected = projectTeams(snapshot);
      const rows = teams
        .map((t) => codeFor(t))
        .filter((c): c is string => Boolean(c))
        .map((c) => projected.get(c))
        .filter((o): o is TeamOdds => Boolean(o));
      return {
        kind: "chances" as const,
        asOf: snapshot.updatedAt,
        teams: rows,
      };
    }
    return buildFavorites(snapshot, top ?? 5);
  },
  toModelOutput(output) {
    if (output.kind === "chances")
      return { type: "text", value: summarizeChances(output.teams) };
    return { type: "text", value: summarizeFavorites(output) };
  },
});
