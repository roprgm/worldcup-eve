"use client";

import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CellPathExplain } from "@/components/widgets/cell-path-explain";
import { Flag } from "@/components/flags";
import { Card as CardFrame } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { CellPath } from "@/lib/predictions/team-path";
import type { Round } from "@/lib/tournament";

// Per-round reach probability (0–1); r32 is group advance, champion is the cup.
export interface StageOddsRow {
  code: string;
  name?: string;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
  // Highest stage index (see STAGES) reached per results; -1 if none. Reached
  // cells show a check, not a prediction.
  reachedIdx: number;
  // Knocked out per results; its unreached cells show a cross.
  eliminated: boolean;
}

/** The breakdown behind a cell, or `undefined` if there's nothing to explain. */
export type ResolveBreakdown = (
  code: string,
  round: Round,
) => CellPath | undefined;

// Columns in bracket order; `round` marks the cells that open a breakdown.
const STAGES = [
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16", round: "R16" },
  { key: "qf", label: "QF", round: "QF" },
  { key: "sf", label: "SF", round: "SF" },
  { key: "final", label: "Final", round: "FINAL" },
  { key: "champion", label: "Cup" },
] as const satisfies ReadonlyArray<{
  key: keyof StageOddsRow;
  label: string;
  round?: Round;
}>;

// Match the row count the params imply, else a modest default.
const DEFAULT_SKELETON_ROWS = 8;
const skeletonKeys = (count?: number) =>
  Array.from(
    { length: Math.min(Math.max(count ?? DEFAULT_SKELETON_ROWS, 1), 48) },
    (_, i) => `row-${i}`,
  );

// Shared by the header and every row so the columns line up.
const STAGE_GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(6,2.4rem)] items-center gap-1 @lg:grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)] @lg:gap-1.5";

// A live team keeps a sliver of a chance, so a value that rounds to 0 floors
// at "<1%" rather than reading as none.
function formatPct(value: number): string {
  const p = value * 100;
  if (p < 0.95) return "<1%";
  if (p < 9.95) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

export type StageOddsHeader =
  | { toggleable: true; showAll: boolean; top: number; onToggle: () => void }
  | { toggleable: false; count: number };

function Card({
  title,
  header,
  children,
}: {
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardFrame className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-between border-b border-surface-divider px-3 text-[11px] font-medium tracking-wide text-muted-foreground">
        <h3 className="truncate text-foreground/70">{title}</h3>
        {header}
      </div>
      {children}
    </CardFrame>
  );
}

function HeaderControl({ header }: { header: StageOddsHeader }) {
  if (!header.toggleable)
    return (
      <span className="shrink-0 text-muted-foreground/60">
        {header.count} {header.count === 1 ? "country" : "countries"}
      </span>
    );
  return (
    <button
      type="button"
      onClick={header.onToggle}
      className="shrink-0 rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {header.showAll ? "All teams" : `Top ${header.top}`}
    </button>
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

// Reached → green check, out → muted cross, else the heat-mapped number.
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
        className="flex h-7 w-full items-center justify-center rounded-[3px] text-pick"
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
        className="flex h-7 w-full items-center justify-center rounded-[3px] text-muted-foreground/50"
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
        "flex h-7 w-full items-center justify-center rounded-[3px] text-[11px] tabular-nums @lg:text-[12px]",
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

function StageRow({
  row,
  openRound,
  onToggle,
  canExplain,
}: {
  row: StageOddsRow;
  openRound: Round | null;
  onToggle: (round: Round, anchor: HTMLElement) => void;
  canExplain: boolean;
}) {
  return (
    <StageGrid className="h-7 animate-fade-in">
      <span className="flex min-w-0 items-center gap-1.5 @lg:gap-2">
        <Flag code={row.code} size={14} />
        <span className="min-w-0 truncate text-[12px] font-medium @lg:text-[13px]">
          <span className="@lg:hidden">{row.code}</span>
          <span className="hidden @lg:inline">{row.name ?? row.code}</span>
        </span>
      </span>
      {STAGES.map((stage, idx) => {
        const reached = idx <= row.reachedIdx;
        const cell = (
          <HeatCell
            value={row[stage.key]}
            reached={reached}
            eliminated={row.eliminated}
          />
        );
        // Only an open prediction with a real chance has a breakdown.
        const interactive =
          canExplain &&
          "round" in stage &&
          !reached &&
          !row.eliminated &&
          row[stage.key] >= 0.005;
        if (!interactive) return <span key={stage.key}>{cell}</span>;

        const isOpen = openRound === stage.round;
        return (
          <button
            key={stage.key}
            type="button"
            aria-expanded={isOpen}
            onClick={(e) => onToggle(stage.round, e.currentTarget)}
            className={cn(
              "block w-full rounded-[3px] transition-shadow hover:ring-1 hover:ring-pick/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isOpen && "ring-1 ring-pick/60",
            )}
          >
            {cell}
          </button>
        );
      })}
    </StageGrid>
  );
}

type StageOddsCardProps =
  | { loading: true; rowCount?: number }
  | {
      loading?: false;
      rows: StageOddsRow[];
      header: StageOddsHeader;
      resolveBreakdown?: ResolveBreakdown;
    };

/** Heat-map table of each team's chance to reach each round; cells open a
 *  breakdown. */
export function StageOddsCard(props: StageOddsCardProps) {
  // The open cell, anchored to its button for the popover; null when none.
  const [open, setOpen] = useState<{
    code: string;
    round: Round;
    anchor: HTMLElement;
  } | null>(null);

  const resolve = props.loading ? undefined : props.resolveBreakdown;
  const breakdown =
    open && resolve ? resolve(open.code, open.round) : undefined;

  return (
    <Card
      title="Chance to reach each round"
      header={
        props.loading ? undefined : <HeaderControl header={props.header} />
      }
    >
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
          ? skeletonKeys(props.rowCount).map((key) => (
              <div key={key} className="flex h-7 items-center">
                <Skeleton className="h-5 w-full" />
              </div>
            ))
          : props.rows.map((row) => (
              <StageRow
                key={row.code}
                row={row}
                openRound={open?.code === row.code ? open.round : null}
                onToggle={(round, anchor) =>
                  setOpen((cur) =>
                    cur && cur.code === row.code && cur.round === round
                      ? null
                      : { code: row.code, round, anchor },
                  )
                }
                canExplain={Boolean(resolve)}
              />
            ))}
      </div>
      {open && breakdown && (
        // Key per cell so it replays its entrance when moving between cells.
        <Popover
          key={`${open.code}:${open.round}`}
          anchor={open.anchor}
          onClose={() => setOpen(null)}
          className="w-[min(20rem,calc(100vw-1rem))] p-2.5"
        >
          <CellPathExplain path={breakdown} />
        </Popover>
      )}
    </Card>
  );
}
