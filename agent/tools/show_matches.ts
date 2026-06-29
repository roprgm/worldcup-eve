import { defineTool } from "eve/tools";
import { z } from "zod";

import { widgetModelOutput } from "@/agent/lib/widget-output";
import { todayMatchViews } from "@/components/widgets/match-view";
import { getMatchResults, type MatchResult } from "@/lib/results";
import { teamById } from "@/lib/tournament";

const teamName = (code: string) => teamById[code]?.name ?? code;

function card(match: MatchResult) {
  return {
    number: match.n,
    home: teamName(match.home.code),
    away: teamName(match.away.code),
    status: match.status,
    score:
      match.status === "scheduled"
        ? null
        : `${match.home.score ?? 0}-${match.away.score ?? 0}`,
    kickoff: match.kickoff,
  };
}

export default defineTool({
  description:
    "Show the user the match card for one or more fixtures — the teams, kickoff, status/score, and win odds. This is the widget for a specific match (e.g. 'when/where do X and Y play', a result, or what's on): pass its FIFA number(s), or scope 'today' / 'live'. Get a fixture's number from get_match_schedule or get_match_forecast. For a long fixture list as text, use get_match_schedule instead.",
  inputSchema: z.object({
    scope: z
      .enum(["today", "live"])
      .optional()
      .describe("All of today's matches, or only those in progress."),
    matches: z
      .array(z.number().int().min(1).max(104))
      .optional()
      .describe("Specific FIFA match numbers (1-104) instead of a scope."),
  }),
  async execute({ scope, matches }) {
    const results = await getMatchResults();

    let selected: MatchResult[];
    if (matches?.length) {
      const wanted = new Set(matches);
      selected = results.matches.filter((m) => wanted.has(m.n));
    } else if (scope === "live") {
      selected = results.matches.filter((m) => m.status === "live");
    } else if (scope === "today") {
      const today = new Set(
        todayMatchViews(results.matches, []).map((v) => v.number),
      );
      selected = results.matches.filter((m) => today.has(m.n));
    } else {
      return { error: "Pass scope ('today' or 'live') or specific matches." };
    }

    if (selected.length === 0)
      return { matches: [], note: "No matches found." };

    return { matches: selected.map(card) };
  },
  toModelOutput: widgetModelOutput,
});
