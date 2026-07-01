"use client";

import { useMemo } from "react";

import {
  type Candidate,
  CircularBracketCard,
  CircularBracketRing,
  type CircularBracketView,
  type TeamJourneys,
  type TeamPaths,
} from "@/components/widgets/circular-bracket-card";
import type {
  JourneyLeg,
  TeamJourney,
} from "@/components/widgets/cell-path-explain";
import { usePredictions, useResults } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { cellPath } from "@/lib/predictions/team-path";
import type { MatchResult, Results } from "@/lib/results";
import { matchByNumber, type Round, teamById } from "@/lib/tournament";

const named = (c: { code: string; probability: number }): Candidate => ({
  code: c.code,
  name: teamById[c.code]?.name,
  probability: c.probability,
});

const baselineMap = (candidates?: { code: string; probability: number }[]) =>
  candidates && new Map(candidates.map((c) => [c.code, c.probability]));

// Tag each live candidate with its baseline chance (0 if it wasn't on the
// baseline list, absent when there's no baseline at all).
const withBaseline = (
  candidates: { code: string; probability: number }[],
  baseline?: Map<string, number>,
): Candidate[] =>
  candidates.map((c) => {
    if (!baseline) return named(c);
    return { ...named(c), baseline: baseline.get(c.code) ?? 0 };
  });

// Knockout wins → the round the team is now in, for the road-to-the-final start.
const ROUND_BY_WINS: Round[] = ["R32", "R16", "QF", "SF", "FINAL"];

// From completed knockout matches: how many each team has won (→ the round it has
// reached) and who's been knocked out. The third-place play-off (103) isn't a
// step toward the final, so it's skipped.
function knockoutProgress(results?: Results) {
  const wins = new Map<string, number>();
  const eliminated = new Set<string>();
  for (const m of results?.matches ?? []) {
    if (m.status !== "final" || m.n < 73 || m.n === 103) continue;
    const winner = m.home.winner ? m.home : m.away.winner ? m.away : null;
    const loser = m.home.winner ? m.away : m.away.winner ? m.home : null;
    if (winner?.code) wins.set(winner.code, (wins.get(winner.code) ?? 0) + 1);
    if (loser?.code) eliminated.add(loser.code);
  }
  return { wins, eliminated };
}

// Round label for any FIFA match number — the group stage (1–72) or a knockout
// round from the static bracket.
const KO_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  TP: "Third place",
  FINAL: "Final",
};
const roundLabelOf = (n: number): string =>
  n <= 72 ? "Group" : (KO_LABEL[matchByNumber[n]?.round] ?? "Knockout");

// A one-line verdict on the team's run: the trophy, still going, or where it went
// out. The third-place play-off (103) isn't an elimination round, so it's ignored.
function outcomeLabel(
  code: string,
  played: MatchResult[],
  alive: boolean,
): string {
  const final = played.find((m) => m.n === 104 && m.status === "final");
  if (final) {
    const mine = final.home.code === code ? final.home : final.away;
    return mine.winner ? "World Cup winners" : "Runners-up";
  }
  if (alive) return "Still in the running";
  const lostKo = [...played]
    .reverse()
    .find(
      (m) =>
        m.n >= 73 &&
        m.n !== 103 &&
        m.status === "final" &&
        (m.home.code === code ? m.away.winner : m.home.winner),
    );
  if (lostKo)
    return `Eliminated in the ${roundLabelOf(lostKo.n).toLowerCase()}`;
  return played.some((m) => m.n >= 73)
    ? "Out of the tournament"
    : "Eliminated in the group stage";
}

// A team's actual run, oriented to its own side: group stage → final, in match
// order. Only started matches count; `undefined` for a team yet to kick off.
function teamJourney(
  results: Results,
  code: string,
  alive: boolean,
): TeamJourney | undefined {
  const played = results.matches
    .filter(
      (m) =>
        (m.home.code === code || m.away.code === code) &&
        m.status !== "scheduled",
    )
    .sort((a, b) => a.n - b.n);
  if (played.length === 0) return undefined;

  const legs: JourneyLeg[] = played.map((m) => {
    const mine = m.home.code === code ? m.home : m.away;
    const opp = m.home.code === code ? m.away : m.home;
    const result: JourneyLeg["result"] =
      m.status !== "final" ? null : mine.winner ? "W" : opp.winner ? "L" : "D";
    return {
      match: m.n,
      roundLabel: roundLabelOf(m.n),
      opponent: opp.code,
      score: `${mine.score ?? 0}\u2013${opp.score ?? 0}`,
      result,
      live: m.status === "live",
    };
  });

  return {
    code,
    name: teamById[code]?.name ?? code,
    outcomeLabel: outcomeLabel(code, played, alive),
    legs,
  };
}

// Played knockout matches, by match number → the actual winner (probability 1).
// These come from real results and override the market's odds, so a finished
// match shows its winner's flag instead of a still-open "?".
function decidedWinners(results?: Results): Map<number, Candidate> {
  const decided = new Map<number, Candidate>();
  if (!results) return decided;
  const byNumber = new Map(results.matches.map((m) => [m.n, m]));
  for (const [num, side] of Object.entries(results.knockoutPicks)) {
    const match = byNumber.get(Number(num));
    const team = side === "home" ? match?.home : match?.away;
    if (team?.code)
      decided.set(Number(num), {
        code: team.code,
        name: teamById[team.code]?.name,
        probability: 1,
      });
  }
  return decided;
}

// Derive the circular view: per R32 slot the teams that could fill it, per match
// each contender's chance to win it (i.e. advance), the real winner of any
// finished match, and the title odds.
function circularView(
  predictions: Predictions,
  results?: Results,
): CircularBracketView {
  const decided = decidedWinners(results);

  // Start-of-day baseline counterparts, to paint the move since the day's start.
  const baselineSlots = new Map(
    predictions.baseline.slots.map((s) => [
      `${s.match}:${s.side}`,
      baselineMap(s.candidates),
    ]),
  );
  const baselineMatch = new Map(
    Object.entries(predictions.baseline.matchWinOdds).map(([match, cands]) => [
      Number(match),
      baselineMap(cands),
    ]),
  );

  const slotOdds = new Map<string, Candidate[]>();
  for (const slot of predictions.slots) {
    const key = `${slot.match}:${slot.side}`;
    slotOdds.set(key, withBaseline(slot.candidates, baselineSlots.get(key)));
  }

  // Each contender's chance to win the match — a finished match is pinned to
  // its real winner (no baseline split: it's settled).
  const matchOdds = new Map<number, Candidate[]>();
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds)) {
    const num = Number(match);
    const win = decided.get(num);
    matchOdds.set(
      num,
      win ? [win] : withBaseline(candidates, baselineMatch.get(num)),
    );
  }

  const live = new Set<number>();
  const liveLeader = new Map<number, string>();
  for (const m of results?.matches ?? []) {
    if (m.status !== "live") continue;
    live.add(m.n);
    const home = m.home.score ?? 0;
    const away = m.away.score ?? 0;
    if (home > away && m.home.code) liveLeader.set(m.n, m.home.code);
    else if (away > home && m.away.code) liveLeader.set(m.n, m.away.code);
  }

  return {
    slotOdds,
    matchOdds,
    decided,
    live,
    liveLeader,
    championOdds: withBaseline(
      predictions.bracketChampion,
      baselineMap(predictions.baseline.bracketChampion),
    ),
  };
}

/** Merges the shared predictions with real results into the view, the per-team
 *  road-to-the-final paths, and each team's actual run so far — everything the
 *  bracket paints onto the radial skeleton. */
function useBracketData(): {
  view?: CircularBracketView;
  teamPaths?: TeamPaths;
  teamJourneys?: TeamJourneys;
} {
  const predictions = usePredictions();
  const results = useResults();
  const view = useMemo(
    () => (predictions ? circularView(predictions, results) : undefined),
    [predictions, results],
  );
  // Road to the final per team still alive. The path starts at the round each
  // team has actually reached (so a match already won isn't shown as a pending
  // prediction), `minReach` of 0 keeps even the longest shots, and the eliminated
  // are dropped outright.
  const teamPaths = useMemo(() => {
    if (!predictions) return undefined;
    const { wins, eliminated } = knockoutProgress(results);
    const map: TeamPaths = new Map();
    for (const team of predictions.reach) {
      if (eliminated.has(team.code)) continue;
      const fromRound = ROUND_BY_WINS[Math.min(wins.get(team.code) ?? 0, 4)];
      const path = cellPath(predictions, team.code, "FINAL", {
        minReach: 0,
        fromRound,
      });
      if (path) map.set(team.code, path);
    }
    return map;
  }, [predictions, results]);
  // Actual run so far per team that has kicked off — winners and losers alike —
  // so every locked-in flag is tappable. `alive` (has a road to the final) picks
  // the "still in the running" verdict over an elimination line.
  const teamJourneys = useMemo(() => {
    if (!results) return undefined;
    const codes = new Set<string>();
    for (const m of results.matches) {
      if (m.status === "scheduled") continue;
      if (m.home.code) codes.add(m.home.code);
      if (m.away.code) codes.add(m.away.code);
    }
    const map: TeamJourneys = new Map();
    for (const code of codes) {
      const journey = teamJourney(results, code, teamPaths?.has(code) ?? false);
      if (journey) map.set(code, journey);
    }
    return map;
  }, [results, teamPaths]);
  return { view, teamPaths, teamJourneys };
}

/** Connected circular bracket: merges the shared predictions with real results
 *  and paints them onto the radial skeleton. */
export function CircularBracketWidget() {
  const { view, teamPaths, teamJourneys } = useBracketData();
  // Market predictions start off; users opt in via the in-card toggle.
  return (
    <CircularBracketCard
      view={view}
      teamPaths={teamPaths}
      teamJourneys={teamJourneys}
    />
  );
}

/** The bracket ring without the card chrome, for the home hero. The predicted
 *  flags overlay stays off here — locked-in teams show, undecided nodes stay "?". */
export function HomeBracket() {
  const { view, teamPaths, teamJourneys } = useBracketData();
  return (
    <CircularBracketRing
      view={view}
      teamPaths={teamPaths}
      teamJourneys={teamJourneys}
    />
  );
}
