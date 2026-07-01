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

const percent = (value: number): number => Math.round(value * 1000) / 10;

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
  const score = snapshot.knockoutScores[match];
  return {
    asOf: snapshot.updatedAt,
    match,
    round: matchByNumber[match]?.round,
    home: homeCode,
    away: awayCode,
    homeWinPct: percent(home / total),
    awayWinPct: percent(away / total),
    predictedScore: score ? { home: score.h, away: score.a } : undefined,
  };
}

// Neutral-site head-to-head from the fitted BT strengths: P(A beats B) =
// s_A / (s_A + s_B). A hypothetical matchup — no fixture — so it's an estimate.
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
    asOf: snapshot.updatedAt,
    home: homeCode,
    away: awayCode,
    homeWinPct: percent(home / total),
    awayWinPct: percent(away / total),
    estimate: true,
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
    "Win odds and a predicted score for ONE matchup. Give two team names/codes, or a match number. A real fixture uses its market (group match 1-72, or a decided knockout 73-104); any other pairing falls back to a neutral-site estimate (estimate: true). Every pairing returns a number, so never say a matchup can't be forecast. For how far a team goes overall, use outlook.",
  inputSchema: z.object({
    match: z
      .number()
      .int()
      .min(1)
      .max(104)
      .optional()
      .describe("FIFA match number, 1-104."),
    teamA: z.string().optional().describe("First team name or code."),
    teamB: z.string().optional().describe("Second team name or code."),
  }),
  async execute({ match, teamA, teamB }) {
    const snapshot = await getPredictions();

    // Knockout match by number: read the decided sides from the bracket slots.
    if (match && match > 72) {
      const home = settledTeam(snapshot, match, "home");
      const away = settledTeam(snapshot, match, "away");
      const forecast =
        home && away
          ? knockoutForecast(snapshot, match, home, away)
          : undefined;
      return (
        forecast ?? {
          asOf: snapshot.updatedAt,
          match,
          error:
            'No head-to-head odds yet — the matchup isn\'t decided (use a <slot n="..." /> for who might play).',
        }
      );
    }

    const fixtureMatch = match
      ? groupMatches.find((m) => m.number === match)
      : undefined;
    if (match && !fixtureMatch) {
      return { error: "Match not found.", requested: { match } };
    }

    const codeA = codeFor(fixtureMatch?.homeId ?? teamA);
    const codeB = codeFor(fixtureMatch?.awayId ?? teamB);
    if (!codeA || !codeB) {
      return {
        error: "Could not resolve both teams.",
        requested: { match, teamA, teamB },
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
        asOf: snapshot.updatedAt,
        match: fixture.number,
        error:
          "No forecast available (the match may be played or has no market).",
      };
    }

    return {
      asOf: snapshot.updatedAt,
      match: fixture.number,
      home: fixture.homeId,
      away: fixture.awayId,
      predictedScore: score ? { home: score.h, away: score.a } : undefined,
      homeWinPct: odds ? percent(odds.homeWin) : undefined,
      awayWinPct: odds ? percent(odds.awayWin) : undefined,
    };
  },
});
