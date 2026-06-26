import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

// Stable keys for the skeleton placeholder rows (one per ranked third / slot).
const RANKING_SKELETON = Array.from({ length: 12 }, (_, i) => `rank-${i}`);
const ODDS_SKELETON = Array.from({ length: 5 }, (_, i) => `odds-${i}`);

export interface ThirdRankingRow {
  group: string; // group letter
  code: string; // team code
  name?: string;
  rank: number;
  points: number;
  goalDiff: string; // pre-formatted, e.g. "+2" / "-1"
  goalsFor: number;
  chance: number; // 0–1, probability of finishing among the best eight thirds
  qualifies: boolean;
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

// rank · team · Pts · GD · GF · marker — shared by the header and every row.
function RankingGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1rem_minmax(0,1fr)_1.75rem_1.75rem_1.75rem_minmax(4.5rem,5.5rem)_1.25rem] items-center gap-x-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

// A proportional bar plus the rounded percentage — the same chance visual the
// odds cards below use, compacted to a single ranking-row cell.
function ChanceCell({ chance }: { chance: number }) {
  const pct = `${Math.round(chance * 100)}%`;
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex h-1.5 flex-1 overflow-hidden rounded-[1px] bg-muted/50">
        <span className="h-full rounded-[1px] bg-pick" style={{ width: pct }} />
      </span>
      <span className="w-7 shrink-0 text-right text-[11px] tabular-nums">
        {pct}
      </span>
    </span>
  );
}

function RankingRow({ row }: { row: ThirdRankingRow }) {
  return (
    <RankingGrid
      className={cn("h-5 tabular-nums", !row.qualifies && "opacity-45")}
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
      <ChanceCell chance={row.chance} />
      <span className="flex justify-center">
        {row.qualifies ? (
          <Check className="size-3 text-pick" strokeWidth={3} />
        ) : (
          <X className="size-3 text-muted-foreground/45" />
        )}
      </span>
    </RankingGrid>
  );
}

export function ThirdsRankingCard(props: ThirdsRankingCardProps) {
  return (
    <Card title="Best thirds" hint="as things stand">
      <div className="flex flex-col gap-1 px-2 py-2">
        <RankingGrid>
          <span />
          <ColumnLabel>Team</ColumnLabel>
          <ColumnLabel className="text-right">Pts</ColumnLabel>
          <ColumnLabel className="text-right">GD</ColumnLabel>
          <ColumnLabel className="text-right">GF</ColumnLabel>
          <ColumnLabel className="text-right">Chance</ColumnLabel>
          <span />
        </RankingGrid>
        {props.loading
          ? RANKING_SKELETON.map((key) => (
              <div key={key} className="flex h-5 items-center">
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : props.rows.map((row) => <RankingRow key={row.group} row={row} />)}
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
