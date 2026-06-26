import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import { Fragment } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

// rank · team · Pts · GD · GF · marker
const RANKING_COLUMNS =
  "1.25rem minmax(0,1fr) 1.75rem 1.75rem 1.75rem 1.25rem";
const QUALIFY_CUT = 8; // the best eight third-placed teams reach the Round of 32

export interface ThirdRankingRow {
  group: string; // group letter
  code: string; // team code
  name?: string;
  rank: number;
  points: number;
  goalDiff: string; // pre-formatted, e.g. "+2" / "-1"
  goalsFor: number;
  qualifies: boolean;
}

export interface ThirdSlotRow {
  match: number; // Round-of-32 match number
  winner: string; // group whose winner hosts this slot
  code: string; // third-placed team code
  name?: string;
}

type ThirdsRankingCardProps =
  | { loading: true }
  | { loading?: false; rows: ThirdRankingRow[] };
type ThirdsSlotsCardProps =
  | { loading: true }
  | { loading?: false; rows: ThirdSlotRow[] };

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
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
  children: React.ReactNode;
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

function RankingRow({ row }: { row: ThirdRankingRow }) {
  return (
    <div
      className={cn(
        "grid items-center gap-x-2 px-1.5 py-1 tabular-nums",
        !row.qualifies && "opacity-45",
      )}
      style={{ gridTemplateColumns: RANKING_COLUMNS }}
    >
      <span className="text-right text-[11px] text-muted-foreground">
        {row.rank}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <Flag code={row.code} size={14} />
        <span className="text-[12px] font-semibold tracking-wide">
          {row.code}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {row.name}
        </span>
      </span>
      <span className="text-right text-[12px] font-semibold">{row.points}</span>
      <span className="text-right text-[11px] text-muted-foreground">
        {row.goalDiff}
      </span>
      <span className="text-right text-[11px] text-muted-foreground">
        {row.goalsFor}
      </span>
      <span className="flex justify-center">
        {row.qualifies ? (
          <Check className="size-3 text-pick" strokeWidth={3} />
        ) : (
          <X className="size-3 text-muted-foreground/45" />
        )}
      </span>
    </div>
  );
}

function CutLine() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[9px] font-medium tracking-widest text-muted-foreground/60 uppercase">
        best 8 qualify
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function ThirdsRankingCard(props: ThirdsRankingCardProps) {
  return (
    <Card title="Best thirds" hint="as things stand">
      <div className="flex flex-col px-1.5 py-1.5">
        <div
          className="grid items-center gap-x-2 px-1.5 pb-1"
          style={{ gridTemplateColumns: RANKING_COLUMNS }}
        >
          <span />
          <ColumnLabel>Team</ColumnLabel>
          <ColumnLabel className="text-right">Pts</ColumnLabel>
          <ColumnLabel className="text-right">GD</ColumnLabel>
          <ColumnLabel className="text-right">GF</ColumnLabel>
          <span />
        </div>
        {props.loading
          ? Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="px-1.5 py-1">
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : props.rows.map((row, i) => (
              <Fragment key={row.group}>
                {i === QUALIFY_CUT && <CutLine />}
                <RankingRow row={row} />
              </Fragment>
            ))}
      </div>
    </Card>
  );
}

function SlotRow({ row }: { row: ThirdSlotRow }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
      <span className="w-16 shrink-0 text-muted-foreground">
        Winner {row.winner}
      </span>
      <span className="shrink-0 text-muted-foreground/50">vs</span>
      <Flag code={row.code} size={14} />
      <span className="font-semibold tracking-wide">{row.code}</span>
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
        {row.name}
      </span>
      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
        #{row.match}
      </span>
    </div>
  );
}

export function ThirdsSlotsCard(props: ThirdsSlotsCardProps) {
  return (
    <Card title="Round of 32" hint="third-place slots">
      <div className="flex flex-col py-1">
        {props.loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="px-2.5 py-1.5">
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : props.rows.map((row) => <SlotRow key={row.match} row={row} />)}
      </div>
    </Card>
  );
}
