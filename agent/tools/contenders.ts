import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { captionOutput } from "@/agent/lib/tool-output";
import { getPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const percent = (p: number) => Math.round(p * 1000) / 10;
const teamName = (code: string) => teamById[code]?.name ?? code;

interface ContenderRow {
  team: string;
  winCupPercent: number;
  reachFinalPercent: number;
}
type ContendersOutput =
  | { coverage: string; teams: ContenderRow[] }
  | { coverage: string; teamCount: number; favourites: ContenderRow[] }
  | { error: string };

function render(output: ContendersOutput): string {
  if ("error" in output) return output.error;
  const rows = "teams" in output ? output.teams : output.favourites;
  if (rows.length === 0) return "No contenders found.";
  return rows.map((r) => `${r.team} ${r.winCupPercent}%`).join(", ");
}

export default defineTool({
  description:
    "Ranked title odds across the field: every team's chance to win the cup and to reach the final. Always shows the favorites widget. Pass `teams` to compare specific teams, or `top` to cap the ranking; pass neither for the whole field.",
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
  async execute({ teams, top }): Promise<ContendersOutput> {
    const snapshot = await getPredictions();
    const ranked = [...snapshot.reach].sort(
      (a, b) => b.mktChampion - a.mktChampion,
    );

    const summarize = (t: (typeof ranked)[number]): ContenderRow => ({
      team: teamName(t.code),
      winCupPercent: percent(t.mktChampion),
      reachFinalPercent: percent(t.final),
    });

    if (teams?.length) {
      const wanted = teams
        .map((t) => codeFor(t))
        .filter((c): c is string => Boolean(c));
      if (!wanted.length)
        return { error: `Unknown team(s): ${teams.join(", ")}.` };
      return {
        coverage: "the requested teams",
        teams: ranked.filter((t) => wanted.includes(t.code)).map(summarize),
      };
    }

    const contenders = ranked.filter((t) => t.final > 0 || t.mktChampion > 0);
    return {
      coverage: top ? `the ${top} most likely teams` : "every team",
      teamCount: contenders.length,
      favourites: contenders.slice(0, top ?? 5).map(summarize),
    };
  },
  toModelOutput: (output) => captionOutput(output, render),
});
