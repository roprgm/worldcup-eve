import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

// One team's chance of reaching each knockout round, all 0–1.
export interface StageOddsRow {
  code: string;
  name?: string;
  r32: number; // P(reach Round of 32) — group stage advance
  r16: number; // P(reach Round of 16)
  qf: number; // P(reach Quarter-finals)
  sf: number; // P(reach Semi-finals)
  final: number; // P(reach Final)
  champion: number; // P(win the cup)
  // Highest stage index (see STAGES) the team has actually reached per real
  // results; -1 if none yet. Those cells show a check instead of a prediction.
  reachedIdx: number;
  // Knocked out per real results: its not-yet-reached cells are a dash, not odds.
  eliminated: boolean;
}

// The stage columns, in bracket order. `key` indexes StageOddsRow; the labels
// are kept short so six columns fit a phone without scrolling.
const STAGES = [
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
  { key: "champion", label: "Cup" },
] as const satisfies ReadonlyArray<{ key: keyof StageOddsRow; label: string }>;

const ROW_SKELETON = Array.from({ length: 16 }, (_, i) => `row-${i}`);

// team · six stage cells. A fixed-but-flexible team column and equal stage cells
// shared by the header and every row so the heat-map grid lines up. The cells
// widen a touch once the card has room (container query).
const STAGE_GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(6,2.4rem)] items-center gap-1 @lg:grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)] @lg:gap-1.5";

// A still-alive team always keeps a sliver of a chance, so a value that rounds to
// zero floors at "<1%" rather than reading as none. Only a confirmed-out team
// shows a dash (handled in HeatCell).
function formatPct(value: number): string {
  const p = value * 100;
  if (p < 0.95) return "<1%";
  if (p < 9.95) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex h-7 items-center justify-between border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-muted-foreground">
        <h3 className="truncate text-foreground/70">{title}</h3>
        {hint && (
          <span className="shrink-0 text-muted-foreground/60">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function StageGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(STAGE_GRID, className)}>{children}</div>;
}

// A heat-mapped probability cell. A stage the team has *actually* reached (per
// results) shows a green check; a stage it is *confirmed out* of shows a muted
// cross; anything still open shows its predicted number (floored at "<1%", never
// 100% as a check) with the green deepening as the chance grows.
function HeatCell({
  value,
  reached,
  eliminated,
}: {
  value: number;
  reached: boolean;
  eliminated: boolean;
}) {
  if (reached)
    return (
      <span
        className="flex h-7 items-center justify-center rounded-[3px] text-pick"
        style={{
          backgroundColor: "color-mix(in oklab, var(--pick) 22%, transparent)",
        }}
      >
        <Check className="size-3.5" aria-label="Reached" />
      </span>
    );

  if (eliminated)
    return (
      <span
        className="flex h-7 items-center justify-center rounded-[3px] text-muted-foreground/50"
        style={{
          backgroundColor:
            "color-mix(in oklab, var(--muted-foreground) 9%, transparent)",
        }}
      >
        <X className="size-3.5" aria-label="Eliminated" />
      </span>
    );

  const tint = Math.round(value * 88);
  const strong = value >= 0.5;
  return (
    <span
      className={cn(
        "flex h-7 items-center justify-center rounded-[3px] text-[11px] tabular-nums @lg:text-[12px]",
        strong ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
      style={{
        backgroundColor: `color-mix(in oklab, var(--pick) ${tint}%, transparent)`,
      }}
    >
      {formatPct(value)}
    </span>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-center text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

function StageRow({ row }: { row: StageOddsRow }) {
  return (
    <StageGrid className="h-7">
      <span className="flex min-w-0 items-center gap-1.5 @lg:gap-2">
        <Flag code={row.code} size={14} />
        <span className="min-w-0 truncate text-[12px] font-medium @lg:text-[13px]">
          <span className="@lg:hidden">{row.code}</span>
          <span className="hidden @lg:inline">{row.name ?? row.code}</span>
        </span>
      </span>
      {STAGES.map((stage, idx) => (
        <HeatCell
          key={stage.key}
          value={row[stage.key]}
          reached={idx <= row.reachedIdx}
          eliminated={row.eliminated}
        />
      ))}
    </StageGrid>
  );
}

type StageOddsCardProps =
  | { loading: true }
  | { loading?: false; rows: StageOddsRow[] };

/** A heat-map table of each team's chance to reach every knockout round and win
 *  the cup — the "road to the final" at a glance. */
export function StageOddsCard(props: StageOddsCardProps) {
  return (
    <Card title="Chance to reach each round">
      <div className="@container flex flex-col gap-1 px-2.5 py-2">
        <StageGrid className="pb-1">
          <span className="pl-0.5 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
            Team
          </span>
          {STAGES.map((stage) => (
            <ColumnLabel key={stage.key}>{stage.label}</ColumnLabel>
          ))}
        </StageGrid>
        {props.loading
          ? ROW_SKELETON.map((key) => (
              <div key={key} className="flex h-7 items-center">
                <Skeleton className="h-5 w-full" />
              </div>
            ))
          : props.rows.map((row) => <StageRow key={row.code} row={row} />)}
      </div>
    </Card>
  );
}
