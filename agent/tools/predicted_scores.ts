import { defineTool } from "eve/tools";
import { z } from "zod";

import { percent, teamName } from "@/agent/lib/fixtures";
import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import type { KnockoutOdds, Predictions } from "@/lib/predictions";
import { matchByNumber } from "@/lib/tournament";

const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third place",
  FINAL: "Final",
};

// The decided knockout match the request names: by number, or by team pair in
// either bracket orientation. Only matches with a live per-game market are in
// `knockoutOdds`, so an undecided or unpriced matchup resolves to nothing.
function resolveMatch(
  snapshot: Predictions,
  match?: number,
  teamA?: string,
  teamB?: string,
): KnockoutOdds | undefined {
  if (match) return snapshot.knockoutOdds.find((o) => o.match === match);
  const codeA = codeFor(teamA);
  const codeB = codeFor(teamB);
  if (!codeA || !codeB) return undefined;
  const pair = new Set([codeA, codeB]);
  return snapshot.knockoutOdds.find(
    (o) => pair.has(o.home) && pair.has(o.away),
  );
}

export default defineTool({
  description:
    "The market's PREDICTED chance for every exact scoreline of ONE decided knockout match (73-104) with a live market, plus its regulation three-way and to-advance odds. This is a forecast, not a result — for a played or in-progress match's actual score use matches or timeline. Give a match number or two team names/codes. Show the result as a `predicted_scores` block (body: the match number) — the widget paints the full goal matrix, so speak one line and never recite the scorelines. If no market exists the tool says so; answer win-odds questions with odds instead.",
  inputSchema: z.object({
    match: z
      .number()
      .int()
      .min(73)
      .max(104)
      .optional()
      .describe("FIFA knockout match number, 73-104."),
    teamA: z.string().optional().describe("First team name or code."),
    teamB: z.string().optional().describe("Second team name or code."),
  }),
  async execute({ match, teamA, teamB }) {
    const snapshot = await getPredictions();
    const odds = resolveMatch(snapshot, match, teamA, teamB);
    const chances = odds
      ? snapshot.knockoutScoreChances[odds.match]
      : undefined;
    if (!odds || !chances?.length) {
      return {
        kind: "none" as const,
        requested: { match, teamA, teamB },
      };
    }
    return {
      kind: "scores" as const,
      asOf: snapshot.updatedAt,
      match: odds.match,
      round: ROUND_LABEL[matchByNumber[odds.match]?.round ?? ""],
      home: { code: odds.home, name: teamName(odds.home) },
      away: { code: odds.away, name: teamName(odds.away) },
      regulation: {
        homeWinPct: percent(odds.homeWin),
        drawPct: odds.draw == null ? undefined : percent(odds.draw),
        awayWinPct: percent(odds.awayWin),
      },
      advance: {
        homePct: percent(odds.homeAdvance),
        awayPct: percent(odds.awayAdvance),
      },
      /** All listed scorelines (home-away), most likely first. */
      scorelines: chances.map((c) => ({
        score: `${c.h}-${c.a}`,
        chancePct: percent(c.p),
      })),
    };
  },
  // One spoken line's worth: the top scorelines and who goes through. The
  // `predicted_scores` widget carries the full matrix.
  toModelOutput(output) {
    if (output.kind === "none")
      return {
        type: "text",
        value:
          "No exact-score market — the matchup isn't a decided knockout game with a live market. Use odds for win odds, or outlook with slot for who might fill an undecided match.",
      };
    const top = output.scorelines
      .slice(0, 3)
      .map((s) => `${s.score} (${s.chancePct}%)`)
      .join(", ");
    const ahead =
      output.advance.homePct >= output.advance.awayPct
        ? `${output.home.name} advance ${output.advance.homePct}%`
        : `${output.away.name} advance ${output.advance.awayPct}%`;
    return {
      type: "text",
      value: `Match ${output.match} (${output.round}), ${output.home.name} vs ${output.away.name} — most likely ${top}. ${ahead}. Show the predicted_scores widget (body: ${output.match}) for the full matrix.`,
    };
  },
});
