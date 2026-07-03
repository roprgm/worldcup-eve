"use client";

import { Info } from "lucide-react";
import { cn } from "cnfast";
import { useMemo, useState } from "react";

import {
  type Candidate,
  CircularBracket,
  type CircularBracketProps,
  type SlotKey,
  slotKey,
  type TeamCode,
  type TeamPaths,
} from "@/components/circular-bracket";
import { usePredictions, useResults } from "@/components/widgets/queries";
import { Card } from "@/components/ui/card";
import type { Predictions } from "@/lib/predictions";
import { cellPath } from "@/lib/predictions/team-path";
import type { Results } from "@/lib/results";
import { type Round, teamById } from "@/lib/tournament";

// A slot occupant this likely is treated as locked in — shown as a flag.
const CONFIRMED = 0.99;

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

// Played knockout matches, by match number → the actual winner.
function decidedWinners(results?: Results): Record<number, TeamCode> {
  const decided: Record<number, TeamCode> = {};
  if (!results) return decided;
  const byNumber = new Map(results.matches.map((m) => [m.n, m]));
  for (const [num, side] of Object.entries(results.knockoutPicks)) {
    const match = byNumber.get(Number(num));
    const team = side === "home" ? match?.home : match?.away;
    if (team?.code) decided[Number(num)] = team.code;
  }
  return decided;
}

// Map the shared predictions + real results onto the bracket's data props: the
// locked-in R32 occupants, each played match's winner, and per-match candidates
// with start-of-day baselines (the final's entry carries the title odds).
function bracketData(
  predictions: Predictions,
  results?: Results,
): CircularBracketProps {
  const decided = decidedWinners(results);

  // Start-of-day baseline counterparts, to paint the move since the day's start.
  // Fall back to the live outputs when a snapshot predates the `baseline` field
  // (e.g. a stale cross-deploy cache entry), so deltas are simply zero.
  const baseline = predictions.baseline ?? predictions;
  const baselineMatch = new Map(
    Object.entries(baseline.matchWinOdds).map(([match, cands]) => [
      Number(match),
      baselineMap(cands),
    ]),
  );

  const slots: Record<SlotKey, TeamCode> = {};
  for (const slot of predictions.slots) {
    const top = slot.candidates[0];
    if (top && top.probability >= CONFIRMED)
      slots[slotKey(slot.match, slot.side)] = top.code;
  }

  // Each contender's chance to win the match; a played match needs no market.
  const matchOdds: Record<number, Candidate[]> = {};
  for (const [match, candidates] of Object.entries(predictions.matchWinOdds)) {
    const num = Number(match);
    if (num in decided) continue;
    matchOdds[num] = withBaseline(candidates, baselineMatch.get(num));
  }
  // The centre node reads the final's entry as the title odds.
  matchOdds[104] = withBaseline(
    predictions.bracketChampion,
    baselineMap(baseline.bracketChampion),
  );

  const live = new Set<number>();
  const liveLeader = new Map<number, TeamCode>();
  for (const m of results?.matches ?? []) {
    if (m.status !== "live") continue;
    live.add(m.n);
    const home = m.home.score ?? 0;
    const away = m.away.score ?? 0;
    if (home > away && m.home.code) liveLeader.set(m.n, m.home.code);
    else if (away > home && m.away.code) liveLeader.set(m.n, m.away.code);
  }

  return { slots, results: decided, predictions: matchOdds, live, liveLeader };
}

/** Merges the shared predictions with real results into the bracket's data
 *  props and per-team road-to-the-final paths. */
function useBracketData(): {
  data?: CircularBracketProps;
  teamPaths?: TeamPaths;
} {
  const predictions = usePredictions();
  const results = useResults();
  const data = useMemo(
    () => (predictions ? bracketData(predictions, results) : undefined),
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
  return { data, teamPaths };
}

const HELP_TEXT =
  "Tap an open node to see each team's chance of reaching the next round, or a locked-in flag to see its road to the final. The chances are computed from the betting market and refresh every minute.";

/** Header info affordance — a popover on tap (native `title` is hover-only). */
function CircularBracketHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="How to read this bracket"
        aria-expanded={open}
        className="flex cursor-pointer items-center text-muted-foreground/55 transition-colors hover:text-muted-foreground"
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          {/* Above the bracket nodes (z-30), which the card isolates. */}
          <div className="absolute top-full right-0 z-50 mt-1.5 w-64 rounded-md border border-surface-border bg-surface-2 p-2 text-xs leading-relaxed text-muted-foreground shadow-lg">
            {HELP_TEXT}
          </div>
        </>
      )}
    </div>
  );
}

/** Compact header switch to turn the predicted-flags overlay on or off. */
function PredictToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Show market predictions"
      onClick={() => onChange(!on)}
      className="flex cursor-pointer items-center gap-1.5"
    >
      <span className="text-xs font-medium text-muted-foreground/70">
        Show market predictions
      </span>
      <span
        className={cn(
          "relative flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-pick" : "bg-surface-border",
        )}
      >
        <span
          className={cn(
            "absolute size-2.5 rounded-full bg-card transition-transform",
            on ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** Connected circular bracket in its chat-widget card: header, help, the
 *  market-predictions toggle and the ring itself. */
export function CircularBracketWidget({
  predict: predictDefault = false,
}: {
  /** Seed the market-predictions overlay on (users can still toggle it off). */
  predict?: boolean;
}) {
  const { data, teamPaths } = useBracketData();
  const [predict, setPredict] = useState(predictDefault);
  return (
    // `isolate` keeps the nodes' z-index inside this card so they don't paint
    // over the page's sticky section header.
    <Card className="isolate">
      <div className="flex h-7 items-center gap-1.5 border-b border-surface-divider px-3">
        <span className="shrink-0 text-xs font-medium tracking-wide text-foreground/70">
          Prediction bracket
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground/55">
          · tap a node to see its chances
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CircularBracketHelp />
        </div>
      </div>
      <div className="px-2 py-4 sm:px-3">
        <div className="mb-2 flex justify-end px-1">
          <PredictToggle on={predict} onChange={setPredict} />
        </div>
        <CircularBracket
          {...data}
          teamPaths={teamPaths}
          isLoading={!data}
          predict={predict}
          className="max-w-[680px]"
        />
      </div>
    </Card>
  );
}

/** The bracket ring without the card chrome, for the home hero. The predicted
 *  flags overlay stays off here — locked-in teams show, undecided nodes stay "?". */
export function HomeBracket() {
  const { data, teamPaths } = useBracketData();
  return <CircularBracket {...data} teamPaths={teamPaths} isLoading={!data} />;
}
