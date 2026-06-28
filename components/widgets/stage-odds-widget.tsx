"use client";

import { useMemo, useState } from "react";

import {
  StageOddsCard,
  type StageOddsRow,
} from "@/components/widgets/stage-odds-card";
import { usePredictions, useResults } from "@/components/widgets/queries";
import type { Predictions } from "@/lib/predictions";
import type { Results } from "@/lib/results";
import { teamById } from "@/lib/tournament";

const isTeam = (code: string) => Boolean(teamById[code]);

// Stage index a team reaches by *winning* the given knockout match — R32 win →
// R16 (1), … , Final win → champion (5). Keyed by FIFA match number range.
function winStage(match: number): number | null {
  if (match >= 73 && match <= 88) return 1; // won R32 → reached R16
  if (match >= 89 && match <= 96) return 2; // won R16 → reached QF
  if (match >= 97 && match <= 100) return 3; // won QF → reached SF
  if (match === 101 || match === 102) return 4; // won SF → reached Final
  if (match === 104) return 5; // won Final → champion
  return null; // 103 is the third-place play-off
}

interface ResultFacts {
  // Highest stage index (see STAGES) each team has actually reached; absent if
  // none yet.
  reached: Map<string, number>;
  // Teams knocked out: they lost a completed knockout match.
  eliminated: Set<string>;
}

// What the real results settle, separate from the model: the round each team has
// reached and whether it is out. Group qualification counts once a group is fully
// played (top two, plus the assigned best thirds once every group is settled);
// each knockout result then advances its winner one stage and eliminates its loser.
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
  // Best-third slots are only final once all twelve groups are; until then the
  // assignment is provisional, so leave those teams as predictions.
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

// Join each team's per-round reach (BT model) with its group-stage advance
// chance (the R32 column) and what the results have settled, keep everyone still
// in the bracket, and order by title odds — the champion-market read laid out as
// a full road-to-the-final table. Needs both inputs: without the results, settled
// rounds would render as ~100% predictions and then flip to checks.
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

/** Teams ranked by title odds with their chance to reach each round and a check
 *  on the rounds they've reached. Defaults to the whole field; `teams` pins it to
 *  a fixed list, `top` opens it on a Top-N cut the user can expand. */
export function StageOddsWidget({ teams, top }: StageOddsWidgetProps) {
  const hasList = Boolean(teams?.length);
  // Field view starts on the Top-N cut only when a `top` was requested; the team
  // list ignores it. State depends on props alone, so the loading→loaded swap
  // never resets it.
  const [showAll, setShowAll] = useState(!(top != null) || hasList);
  const predictions = usePredictions();
  const results = useResults();
  // Wait for both: results carry the settled-round facts, so rendering on
  // predictions alone would briefly show confirmed teams as ~100% before the
  // checks land — a visible flip and layout shift.
  const all = useMemo(
    () =>
      predictions && results ? stageRows(predictions, results) : undefined,
    [predictions, results],
  );

  if (!all) return <StageOddsCard loading />;

  if (hasList) {
    const wanted = new Set(teams);
    const rows = all.filter((row) => wanted.has(row.code));
    return (
      <StageOddsCard
        rows={rows}
        header={{ toggleable: false, count: rows.length }}
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
    />
  );
}
