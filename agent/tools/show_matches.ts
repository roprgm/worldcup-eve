import { defineTool } from "eve/tools";
import { z } from "zod";

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
    "Show the user match cards (teams, score, live status or kickoff). Pass scope 'today' or 'live' for the day's slate or the matches in progress, or specific match numbers. The go-to for 'what's playing now / today'. Best for a handful of matches; for a long fixture list use get_match_schedule instead.",
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

    return {
      shownAsWidget: "Shown to the user as a widget — don't re-list it.",
      matches: selected.map(card),
    };
  },
});
