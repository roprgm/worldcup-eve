import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  buildBracket,
  buildFavorites,
  buildGroupOdds,
  buildSlot,
  buildTeamOutlook,
  projectTeams,
  summarizeBracket,
  summarizeFavorites,
  summarizeGroupOdds,
  summarizeSlot,
  summarizeTeam,
} from "@/agent/lib/outlook";
import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import { type GroupLetter, groupLetters, teams } from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

export default defineTool({
  description:
    "How far World Cup teams go over the whole tournament — never a single game (that's matches or odds). Pass a team for its chances and projected route; a group for its advancement odds; top:N for the title favorites; slot:<73-104> for who's likely to fill an undecided knockout match; or bracket:true for the whole projected bracket in ONE call. To DISPLAY any of these, prefer the matching `show_*` widget tool, which returns the same gist. Use this when you only need the numbers in prose.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("A team name or code, for its outlook and route."),
    group: groupLetter
      .optional()
      .describe("A group letter, A-L, for its advancement odds."),
    top: z
      .number()
      .int()
      .min(1)
      .max(24)
      .optional()
      .describe("Show the N title favourites."),
    slot: z
      .number()
      .int()
      .min(73)
      .max(104)
      .optional()
      .describe("A knockout match number, for who's likely to play in it."),
    bracket: z
      .boolean()
      .optional()
      .describe(
        "The market's whole projected bracket, summarized — one call covers every round.",
      ),
  }),
  async execute({ team, group, top, slot, bracket }) {
    const snapshot = await getPredictions();

    if (bracket) return buildBracket(snapshot);
    if (slot) return buildSlot(snapshot, slot);

    if (team) {
      const code = codeFor(team);
      const found = code ? projectTeams(snapshot).get(code) : undefined;
      return buildTeamOutlook(
        snapshot,
        found,
        teams.map((t) => t.name),
      );
    }

    if (group) return buildGroupOdds(snapshot, group);

    return buildFavorites(snapshot, top ?? 8);
  },
  // Keep the model's view compact: a sentence (or a few) instead of every team's
  // full breakdown. The widget tags carry the rich display.
  toModelOutput(output) {
    switch (output.kind) {
      case "unknown":
        return {
          type: "text",
          value: `Unknown team. Known teams include: ${output.knownTeams.slice(0, 8).join(", ")}.`,
        };
      case "out":
        return { type: "text", value: output.note };
      case "bracket":
        return { type: "text", value: summarizeBracket(output) };
      case "slot":
        return { type: "text", value: summarizeSlot(output) };
      case "team":
        return { type: "text", value: summarizeTeam(output) };
      case "group":
        return { type: "text", value: summarizeGroupOdds(output) };
      default:
        return { type: "text", value: summarizeFavorites(output) };
    }
  },
});
