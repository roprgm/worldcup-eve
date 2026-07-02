import { cn } from "cnfast";
import type { ReactNode } from "react";

import { Flag } from "@/components/flags";
import { Card as CardFrame } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ScoreCell {
  h: number; // home goals
  a: number; // away goals
  p: number; // chance of this exact scoreline
}

export interface MatrixTeam {
  code: string;
  name?: string;
}

// The market lists scorelines 0-0 through 3-3; rows are home goals, columns away.
const GOALS = [0, 1, 2, 3];

// Rows: away-team header, goal-number header, then one per home goal count.
const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

const MATRIX_GRID = "grid grid-cols-[3.25rem_repeat(4,minmax(0,1fr))] gap-1";

// Same floor as the stage-odds heat map, so a thin chance never reads as none.
function formatPct(value: number): string {
  const p = value * 100;
  if (p < 0.95) return "<1%";
  if (p < 9.95) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

function Card({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardFrame className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-between border-b border-surface-divider px-3 text-xs font-medium tracking-wide text-muted-foreground">
        <h3 className="truncate text-foreground/70">Exact score chances</h3>
        {header}
      </div>
      {children}
    </CardFrame>
  );
}

// Scoreline chances are small, so tint relative to the matrix's own peak — an
// absolute scale (like the reach table's) would leave the whole card washed out.
function HeatCell({ value, max }: { value: number; max: number }) {
  const tint = max > 0 ? Math.round((value / max) * 85) : 0;
  const lead = max > 0 && value === max;
  return (
    <span
      className={cn(
        "flex h-7 items-center justify-center rounded-[3px] text-xs tabular-nums",
        lead ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
      style={{
        backgroundColor: `color-mix(in oklab, var(--pick) ${tint}%, transparent)`,
      }}
    >
      {formatPct(value)}
    </span>
  );
}

function TeamTag({ team }: { team: MatrixTeam }) {
  return (
    <span
      title={team.name}
      className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wide"
    >
      <Flag code={team.code} size={14} />
      {team.code}
    </span>
  );
}

function Matrix({
  home,
  away,
  cells,
}: {
  home: MatrixTeam;
  away: MatrixTeam;
  cells: ScoreCell[];
}) {
  const byScore = new Map(cells.map((c) => [`${c.h}:${c.a}`, c.p]));
  const max = Math.max(0, ...cells.map((c) => c.p));
  return (
    <div className="flex flex-col gap-1 px-2.5 py-2">
      <div className={MATRIX_GRID}>
        <span />
        <span className="col-span-4 flex h-5 items-center justify-center">
          <TeamTag team={away} />
        </span>
      </div>
      <div className={MATRIX_GRID}>
        <span className="flex h-5 items-center justify-center">
          <TeamTag team={home} />
        </span>
        {GOALS.map((goals) => (
          <span
            key={goals}
            className="flex h-5 items-center justify-center text-xs font-medium text-muted-foreground/70 tabular-nums"
          >
            {goals}
          </span>
        ))}
      </div>
      {GOALS.map((homeGoals) => (
        <div key={homeGoals} className={MATRIX_GRID}>
          <span className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground/70 tabular-nums">
            {homeGoals}
          </span>
          {GOALS.map((awayGoals) => (
            <HeatCell
              key={awayGoals}
              value={byScore.get(`${homeGoals}:${awayGoals}`) ?? 0}
              max={max}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MatrixSkeleton() {
  return (
    <div className="animate-pulse space-y-1 px-2.5 py-2" aria-hidden>
      {SKELETON_ROWS.map((row) => (
        <div key={row} className="flex h-7 items-center">
          <Skeleton className="h-5 w-full" />
        </div>
      ))}
    </div>
  );
}

export type ScoreMatrixCardProps =
  | { loading: true }
  | { loading?: false; empty: true }
  | {
      loading?: false;
      empty?: false;
      number: number;
      phaseLabel: string;
      home: MatrixTeam;
      away: MatrixTeam;
      cells: ScoreCell[];
    };

/** Heat-map matrix of a decided knockout match's exact-score chances: rows are
 *  the home team's goals, columns the away team's. */
export function ScoreMatrixCard(props: ScoreMatrixCardProps) {
  if (props.loading)
    return (
      <Card>
        <MatrixSkeleton />
      </Card>
    );

  if (props.empty || props.cells.length === 0)
    return (
      <Card>
        <p className="px-3 py-4 text-xs text-muted-foreground/40 italic">
          no exact-score market for this matchup yet
        </p>
      </Card>
    );

  return (
    <Card
      header={
        <span className="shrink-0 text-muted-foreground/60 tabular-nums">
          #{props.number} · {props.phaseLabel}
        </span>
      }
    >
      <Matrix home={props.home} away={props.away} cells={props.cells} />
    </Card>
  );
}
