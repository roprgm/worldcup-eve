// Scoring a run against reality. A pick earns its round's weight when it names
// the actual winner of a match that has since finished — the classic doubling
// bracket pool, so calling the final right is worth as much as the whole R32.

import type { Results } from "@/lib/results";
import type { Round } from "@/lib/tournament";
import { playedWinners, type TeamCode } from "./board";
import { bracketMatches } from "./bracket";

const ROUND_POINTS: Record<Round, number> = {
  R32: 1,
  R16: 2,
  QF: 4,
  SF: 8,
  TP: 0,
  FINAL: 16,
};

export interface Score {
  points: number;
  /** Points available from the matches that have already finished. */
  maxPoints: number;
  correct: number;
  /** Finished matches the run had a pick for — the ones that could be scored. */
  decided: number;
}

/** Score a run's picks against the results so far. Only matches the run actually
 *  predicted and that are now decided count, so a run made mid-tournament isn't
 *  penalised for matches it was never asked about. */
export function scoreRun(
  picks: Record<number, TeamCode>,
  results: Results,
): Score {
  const actual = playedWinners(results);
  let points = 0;
  let maxPoints = 0;
  let correct = 0;
  let decided = 0;

  for (const m of bracketMatches) {
    const winner = actual[m.number];
    const pick = picks[m.number];
    if (!winner || !pick) continue; // not finished, or the run didn't predict it
    decided++;
    maxPoints += ROUND_POINTS[m.round];
    if (pick === winner) {
      points += ROUND_POINTS[m.round];
      correct++;
    }
  }

  return { points, maxPoints, correct, decided };
}

export interface RankedRun<T> {
  run: T;
  score: Score;
}

/** Every run scored and ranked: most points first, then most correct picks,
 *  then fastest. The single ordering shared by the leaderboard and the detail
 *  view's prev/next stepping. Generic over anything carrying picks + duration. */
export function rankRuns<
  T extends { picks: Record<number, TeamCode>; durationMs: number },
>(runs: T[], results: Results): RankedRun<T>[] {
  return runs
    .map((run) => ({ run, score: scoreRun(run.picks, results) }))
    .sort(
      (a, b) =>
        b.score.points - a.score.points ||
        b.score.correct - a.score.correct ||
        a.run.durationMs - b.run.durationMs,
    );
}
