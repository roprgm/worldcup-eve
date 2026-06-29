import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import type { Predictions } from "@/lib/predictions";
import {
  groupFixture,
  groupMatches,
  knockoutMatches,
  matchByNumber,
} from "@/lib/tournament";

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

// A knockout slot counts as decided once its leading team is all but certain;
// only then is the matchup a real head-to-head rather than a field of candidates.
const SETTLED = 0.99;

function settledTeam(
  snapshot: Predictions,
  match: number,
  side: "home" | "away",
): string | undefined {
  const top = snapshot.slots.find((s) => s.match === match && s.side === side)
    ?.candidates[0];
  return top && top.probability >= SETTLED ? top.code : undefined;
}

// Two-way win odds for a decided knockout match, from the BT winner distribution.
function knockoutForecast(
  snapshot: Predictions,
  match: number,
  homeCode: string,
  awayCode: string,
) {
  const byCode = new Map(
    (snapshot.matchWinOdds[match] ?? []).map((c) => [c.code, c.probability]),
  );
  const home = byCode.get(homeCode) ?? 0;
  const away = byCode.get(awayCode) ?? 0;
  const total = home + away;
  if (total <= 0) return undefined;
  // For R32, matchWinOdds and the scoreline come straight from the per-game
  // market; deeper rounds are still the BT model's inference.
  const score = snapshot.knockoutScores[match];
  return {
    updatedAt: snapshot.updatedAt,
    match,
    round: matchByNumber[match]?.round,
    home: homeCode,
    away: awayCode,
    homeWinPercent: percent(home / total),
    awayWinPercent: percent(away / total),
    predictedScore: score ? { home: score.h, away: score.a } : undefined,
  };
}

// Neutral-site head-to-head from the fitted BT strengths: P(A beats B) =
// s_A / (s_A + s_B). A hypothetical matchup — no fixture, no draw required —
// so it's a model estimate, weaker than a priced market.
function strengthForecast(
  snapshot: Predictions,
  homeCode: string,
  awayCode: string,
) {
  const home = snapshot.teamStrengths[homeCode];
  const away = snapshot.teamStrengths[awayCode];
  if (home == null || away == null) return undefined;
  const total = home + away;
  if (total <= 0) return undefined;
  return {
    updatedAt: snapshot.updatedAt,
    home: homeCode,
    away: awayCode,
    homeWinPercent: percent(home / total),
    awayWinPercent: percent(away / total),
    hypothetical: true,
  };
}

// The decided knockout match between two teams, in either bracket orientation.
function knockoutBetween(snapshot: Predictions, codeA: string, codeB: string) {
  for (const m of knockoutMatches) {
    if (m.round === "TP") continue; // the play-off isn't in the BT winner map
    const home = settledTeam(snapshot, m.number, "home");
    const away = settledTeam(snapshot, m.number, "away");
    if (!home || !away) continue;
    if (
      (home === codeA && away === codeB) ||
      (home === codeB && away === codeA)
    ) {
      return knockoutForecast(snapshot, m.number, home, away);
    }
  }
  return undefined;
}

export default defineTool({
  description:
    "Two-way win odds for any matchup between two teams. A real fixture uses its market: predicted scoreline + win odds for an upcoming group match (1-72), or head-to-head win odds for a decided knockout match (73-104). Any other pairing (two teams who haven't been drawn together) falls back to a neutral-site model estimate (`hypothetical: true`). Give it the two teams or the match number.",
  inputSchema: z.object({
    matchId: z
      .number()
      .int()
      .min(1)
      .max(104)
      .optional()
      .describe("FIFA match number, 1-104."),
    teamA: z.string().optional().describe("First team name or code."),
    teamB: z.string().optional().describe("Second team name or code."),
  }),
  async execute({ matchId, teamA, teamB }) {
    const snapshot = await getPredictions();

    // Knockout match by number: read the decided sides from the bracket slots.
    if (matchId && matchId > 72) {
      const home = settledTeam(snapshot, matchId, "home");
      const away = settledTeam(snapshot, matchId, "away");
      const forecast =
        home && away
          ? knockoutForecast(snapshot, matchId, home, away)
          : undefined;
      return (
        forecast ?? {
          updatedAt: snapshot.updatedAt,
          match: matchId,
          error:
            "No head-to-head odds yet — the matchup isn't decided (use show_knockout_match for who might play).",
        }
      );
    }

    const match = matchId
      ? groupMatches.find((m) => m.number === matchId)
      : undefined;
    if (matchId && !match) {
      return { error: "Match not found.", requested: { matchId } };
    }

    const codeA = codeFor(match?.homeId ?? teamA);
    const codeB = codeFor(match?.awayId ?? teamB);
    if (!codeA || !codeB) {
      return {
        error: "Could not resolve both teams.",
        requested: { matchId, teamA, teamB },
      };
    }

    const fixture = groupFixture(codeA, codeB);
    if (!fixture) {
      // Not a group pairing — try a decided knockout matchup, then fall back to
      // a neutral-site estimate from the model's team strengths.
      const knockout = knockoutBetween(snapshot, codeA, codeB);
      if (knockout) return knockout;
      const estimate = strengthForecast(snapshot, codeA, codeB);
      if (estimate) return estimate;
      return {
        error: "No forecast available — couldn't resolve both teams.",
        requested: { teamA: codeA, teamB: codeB },
      };
    }

    const score = snapshot.groupScores[fixture.id];
    const odds = snapshot.matchOdds.find((o) => o.matchId === fixture.id);
    if (!score && !odds) {
      return {
        updatedAt: snapshot.updatedAt,
        fixture: fixture.id,
        error:
          "No forecast available (the match may be played or has no market).",
      };
    }

    return {
      updatedAt: snapshot.updatedAt,
      fixture: fixture.id,
      home: fixture.homeId,
      away: fixture.awayId,
      predictedScore: score ? { home: score.h, away: score.a } : undefined,
      homeWinPercent: odds ? percent(odds.homeWin) : undefined,
      awayWinPercent: odds ? percent(odds.awayWin) : undefined,
    };
  },
});
