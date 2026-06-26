"use client";

import { cn } from "cnfast";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

// Stable keys for the skeleton placeholder rows (one per ranked third / slot).
const RANKING_SKELETON = Array.from({ length: 12 }, (_, i) => `rank-${i}`);
const ODDS_SKELETON = Array.from({ length: 5 }, (_, i) => `odds-${i}`);

// One Round-of-32 slot a third-placed team could fill, with its chance.
export interface ThirdSlotChance {
  match: number;
  host: string; // group winner that hosts the slot
  prob: number; // 0–1, chance this team fills it
}

export interface ThirdRankingRow {
  group: string; // group letter
  code: string; // team code
  name?: string;
  points: number;
  goalDiff: string; // pre-formatted, e.g. "+2" / "-1"
  goalsFor: number;
  // Per-slot chances (sorted, biggest first); their sum is the qualify chance.
  segments: ThirdSlotChance[];
  chance: number; // 0–1, probability of finishing among the best eight thirds
}

export interface ThirdOddsCandidate {
  code: string; // team code (a group's current third-placed team)
  name?: string;
  probability: number; // 0–1, chance this team fills the slot
}

type ThirdsRankingCardProps =
  | { loading: true }
  | { loading?: false; rows: ThirdRankingRow[] };
type ThirdOddsCardProps = {
  host: string; // group whose winner hosts the slot
  match: number;
} & ({ loading: true } | { loading?: false; candidates: ThirdOddsCandidate[] });

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
          <span className="shrink-0 text-muted-foreground/60 uppercase">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ColumnLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

// team · group · Pts · GD · GF · chance · disclosure — shared by the header,
// every row and the expanded breakdown so they all line up. The fixed-width
// code keeps the chance bars starting at one x.
const RANKING_GRID =
  "grid grid-cols-[3.75rem_1.25rem_1.75rem_1.75rem_1.75rem_minmax(6rem,1fr)_0.75rem] items-center gap-x-1.5";

function RankingGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(RANKING_GRID, className)}>{children}</div>;
}

// A proportional bar and its rounded percentage. `pl-1.5` gives the bar the same
// breathing room from GF that the other columns have between each other.
function ChanceBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = `${Math.round(value * 100)}%`;
  return (
    <span className="flex items-center gap-1.5 pl-1.5">
      <span className="flex h-1.5 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
        <span
          className={cn("h-full rounded-[1px] bg-pick", className)}
          style={{ width: pct }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {pct}
      </span>
    </span>
  );
}

// Tree guide on the left of a breakdown row: a vertical spine dropping from the
// flag's centre (7px in) plus a horizontal tick into the row. The last child
// caps the spine at its centre (└), earlier ones run it past the gap (├).
function TreeConnector({ last }: { last: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-[7px] top-0 w-px bg-white/10",
          last ? "h-1/2" : "h-[calc(100%+0.25rem)]",
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[7px] top-1/2 h-px w-[14px] -translate-y-1/2 bg-white/10"
      />
    </>
  );
}

// The expanded view: one bar per Round-of-32 slot the team could fill, each
// aligned under the row's chance bar so the parts visibly add up to the whole.
// Rows are a touch shorter than the main rows so the slot bars sit a bit tighter.
function SlotBreakdown({ segments }: { segments: ThirdSlotChance[] }) {
  return (
    <div className="flex flex-col gap-1 pt-1">
      {segments.map((s, i) => (
        <div key={s.match} className={cn(RANKING_GRID, "relative h-[18px]")}>
          <TreeConnector last={i === segments.length - 1} />
          <span className="col-span-5 truncate pl-[28px] text-[11px] text-muted-foreground tabular-nums">
            Match {s.match} - Winner {s.host}
          </span>
          <ChanceBar value={s.prob} className="bg-pick/55" />
          <span />
        </div>
      ))}
    </div>
  );
}

function RankingRow({
  row,
  open,
  onToggle,
}: {
  row: ThirdRankingRow;
  open: boolean;
  onToggle: () => void;
}) {
  // Expandable whenever there's a reachable slot — even a single-destination
  // team (e.g. a locked-in 100%) can reveal which slot it would fill.
  const expandable = row.segments.length > 0;
  const isOpen = expandable && open;
  const breakdownId = useId();

  return (
    <div>
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? isOpen : undefined}
        aria-controls={expandable ? breakdownId : undefined}
        onClick={onToggle}
        className={cn(
          RANKING_GRID,
          "h-5 w-full rounded-[3px] text-left tabular-nums",
          expandable
            ? "cursor-pointer hover:bg-surface-2/40"
            : "cursor-default",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Flag code={row.code} size={14} />
          <span
            title={row.name}
            className="w-9 shrink-0 truncate text-[12px] font-semibold tracking-wide"
          >
            {row.code}
          </span>
        </span>
        <span className="text-center text-[11px] text-muted-foreground">
          {row.group}
        </span>
        <span className="text-right text-[12px] font-semibold">
          {row.points}
        </span>
        <span className="text-right text-[11px] text-muted-foreground">
          {row.goalDiff}
        </span>
        <span className="text-right text-[11px] text-muted-foreground">
          {row.goalsFor}
        </span>
        <ChanceBar value={row.chance} />
        <span className="flex justify-center">
          {expandable && (
            <ChevronRight
              className={cn(
                "size-3 text-muted-foreground/50 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          )}
        </span>
      </button>
      {expandable && (
        <div
          id={breakdownId}
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <SlotBreakdown segments={row.segments} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ThirdsRankingCard(props: ThirdsRankingCardProps) {
  // One breakdown open at a time: opening a row collapses any other.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <Card title="Best thirds" hint="ranked by chance">
      <div className="flex flex-col gap-1 px-2 py-2">
        <RankingGrid>
          <ColumnLabel>Team</ColumnLabel>
          <ColumnLabel className="text-center">Grp</ColumnLabel>
          <ColumnLabel className="text-right">Pts</ColumnLabel>
          <ColumnLabel className="text-right">GD</ColumnLabel>
          <ColumnLabel className="text-right">GF</ColumnLabel>
          <ColumnLabel className="pl-1.5">Chance</ColumnLabel>
          <span />
        </RankingGrid>
        {props.loading
          ? RANKING_SKELETON.map((key) => (
              <div key={key} className="flex h-5 items-center">
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : props.rows.map((row) => (
              <RankingRow
                key={row.group}
                row={row}
                open={openGroup === row.group}
                onToggle={() =>
                  setOpenGroup((g) => (g === row.group ? null : row.group))
                }
              />
            ))}
      </div>
    </Card>
  );
}

function OddsRow({
  candidate,
  lead,
}: {
  candidate: ThirdOddsCandidate;
  lead: boolean;
}) {
  const pct = `${Math.round(candidate.probability * 100)}%`;
  return (
    <div className="flex h-5 items-center gap-1.5">
      <Flag code={candidate.code} size={14} />
      <span
        title={candidate.name}
        className={cn(
          "w-9 shrink-0 text-[12px] font-semibold tracking-wide",
          lead ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {candidate.code}
      </span>
      <span className="flex h-1.5 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
        <span
          className={cn(
            "h-full rounded-[1px]",
            lead ? "bg-pick" : "bg-muted-foreground/30",
          )}
          style={{ width: pct }}
        />
      </span>
      <span
        className={cn(
          "w-9 text-right text-[12px] tabular-nums",
          lead ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {pct}
      </span>
    </div>
  );
}

/** One Round-of-32 third slot: which team fills it, with each candidate's
 *  chance. The header names the group winner that hosts it. */
export function ThirdOddsCard(props: ThirdOddsCardProps) {
  return (
    <Card title={`Winner ${props.host}`} hint={`#${props.match}`}>
      <div className="flex flex-col gap-1 px-2 py-2">
        {props.loading
          ? ODDS_SKELETON.map((key) => (
              <div key={key} className="py-0.5">
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : props.candidates.map((candidate, i) => (
              <OddsRow
                key={candidate.code}
                candidate={candidate}
                lead={i === 0}
              />
            ))}
      </div>
    </Card>
  );
}
