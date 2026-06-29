import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { widgetModelOutput } from "@/agent/lib/widget-output";
import { getPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

export default defineTool({
  description:
    "Show the user the road-to-the-final widget: a ranked table of teams' chances (in %) to reach each knockout round (Round of 32 → Final) and to win the cup. This is the tool for how LIKELY teams are to advance or go all the way — for the whole field, the top favourites, or a chosen set of teams. Inputs (both optional): `top` to show only the N most likely (e.g. top: 5 for \"who's most likely to reach the final\"), and `teams` to show only those teams (e.g. teams: ['Argentina','Spain'] for \"odds of Argentina and Spain to reach the final\"); pass neither for every team. Do NOT use this for a single team's projected OPPONENTS, the stadium/city it plays a round, or its match-by-match route — that is show_team_path. Do NOT use it for the bracket matchup layout — that is show_bracket.",
  inputSchema: z.object({
    teams: z
      .array(z.string())
      .optional()
      .describe(
        "Country names or codes to show only those rows, e.g. ['Argentina','ESP'].",
      ),
    top: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Show only the N most likely teams by title odds, e.g. 5."),
  }),
  async execute({ teams, top }) {
    const snapshot = await getPredictions();
    const ranked = [...snapshot.reach].sort(
      (a, b) => b.mktChampion - a.mktChampion,
    );

    const wanted = teams
      ?.map((t) => codeFor(t))
      .filter((c): c is string => Boolean(c));
    if (teams?.length && !wanted?.length) {
      return { error: "Unknown team.", requested: { teams } };
    }

    // A short caption summary; the widget renders the full table.
    const picked = wanted?.length
      ? ranked.filter((t) => wanted.includes(t.code))
      : ranked.slice(0, Math.min(top ?? 5, 8));

    return {
      teams: picked.map((t) => ({
        team: teamName(t.code),
        winCupPercent: percent(t.mktChampion),
        reachFinalPercent: percent(t.final),
      })),
    };
  },
  toModelOutput: widgetModelOutput,
});
