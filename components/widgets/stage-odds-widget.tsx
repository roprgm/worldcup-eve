"use client";

import { useMemo, useState } from "react";

import {
  type ResolveBreakdown,
  StageOddsCard,
  type StageOddsRow,
} from "@/components/widgets/stage-odds-card";
import { usePredictions, useResults } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import { cellPath } from "@/lib/predictions/team-path";
import type { Results } from "@/lib/results";
import { teamById } from "@/lib/tournament";

const isTeam = (code: string) => Boolean(teamById[code]);

// Stage index a team reaches by winning the given knockout match (R32 win → R16,
// … , Final win → champion), by FIFA match number; null for the play-off (103).
function winStage(match: number): number | null {
  if (match >= 73 && match <= 88) return 1;
  if (match >= 89 && match <= 96) return 2;
  if (match >= 97 && match <= 100) return 3;
  if (match === 101 || match === 102) return 4;
  if (match === 104) return 5;
  return null;
}

interface ResultFacts {
  reached: Map<string, number>; // highest stage index reached
  eliminated: Set<string>; // lost a completed knockout match
}

// What the results settle (not the model): each team's reached round and whether
// it's out, from settled group finishes and completed knockout matches.
function resultFacts(results: Results): ResultFacts {
  const reached = new Map<string, number>();
  const eliminated = new Set<string>();
  const bump = (code: string, idx: number) => {
    if (!isTeam(code)) return;
    if (idx > (reached.get(code) ?? -1)) reached.set(code, idx);
  };

  for (const order of Object.values(results.settledGroupOrder)) {
    bump(order[0], 0);
    bump(order[1], 0);
  }
  // Third-place slots are provisional until all twelve groups are settled.
  if (Object.keys(results.settledGroupOrder).length === 12)
    for (const slot of results.thirdSlots) bump(slot.teamId, 0);

  for (const m of results.matches) {
    if (m.status !== "final" || m.n <= 72) continue;
    const winner = m.home.winner ? m.home : m.away.winner ? m.away : null;
    const loser = m.home.winner ? m.away : m.away.winner ? m.home : null;
    if (loser && isTeam(loser.code)) eliminated.add(loser.code);
    const idx = winStage(m.n);
    if (idx != null && winner) bump(winner.code, idx);
  }
  return { reached, eliminated };
}

// Build the table rows: per-round reach (model) + group advance (R32) + settled
// results, dropping the eliminated and ranking by title odds.
function stageRows(predictions: Predictions, results: Results): StageOddsRow[] {
  const advanceByCode = new Map<string, number>();
  for (const group of predictions.groups)
    for (const team of group.teams) advanceByCode.set(team.code, team.advance);
  const facts = resultFacts(results);

  return predictions.reach
    .map((team) => ({
      code: team.code,
      name: teamById[team.code]?.name,
      r32: advanceByCode.get(team.code) ?? 0,
      r16: team.r16,
      qf: team.qf,
      sf: team.sf,
      final: team.final,
      champion: team.mktChampion,
      reachedIdx: facts.reached.get(team.code) ?? -1,
      eliminated: facts.eliminated.has(team.code),
    }))
    .filter((row) => row.r32 > 0 || row.r16 > 0 || row.reachedIdx >= 0)
    .sort((a, b) => b.champion - a.champion || b.final - a.final);
}

interface StageOddsWidgetProps {
  /** Show only these teams (FIFA codes); omit for the whole field. */
  teams?: string[];
  /** Cap the field to its N most likely (default 5 when toggled on). */
  top?: number;
}

const DEFAULT_TOP = 5;

/** The road-to-the-final table. Whole field by default; `teams` pins a list,
 *  `top` opens on a Top-N cut. */
export function StageOddsWidget({ teams, top }: StageOddsWidgetProps) {
  const hasList = Boolean(teams?.length);
  // Start on the Top-N cut only when `top` was given. Derived from props so the
  // loading→loaded swap never resets it.
  const [showAll, setShowAll] = useState(!(top != null) || hasList);
  const predictions = usePredictions();
  const results = useResults();
  // Wait for both: results carry the settled-round facts, else confirmed teams
  // flash ~100% before the checks land.
  const all = useMemo(
    () =>
      predictions && results ? stageRows(predictions, results) : undefined,
    [predictions, results],
  );

  // The params fix the row count, so the skeleton can match it.
  if (!all || !predictions)
    return <StageOddsCard loading rowCount={hasList ? teams?.length : top} />;

  const resolveBreakdown: ResolveBreakdown = (code, round) =>
    cellPath(predictions, code, round);

  if (hasList) {
    const wanted = new Set(teams);
    const rows = all.filter((row) => wanted.has(row.code));
    return (
      <StageOddsCard
        rows={rows}
        header={{ toggleable: false, count: rows.length }}
        resolveBreakdown={resolveBreakdown}
      />
    );
  }

  const topCount = top ?? DEFAULT_TOP;
  const rows = showAll ? all : all.slice(0, topCount);
  return (
    <StageOddsCard
      rows={rows}
      header={{
        toggleable: true,
        showAll,
        top: topCount,
        onToggle: () => setShowAll((v) => !v),
      }}
      resolveBreakdown={resolveBreakdown}
    />
  );
}
