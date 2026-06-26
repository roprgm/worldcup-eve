import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { Flag } from "@/components/flags";
import { Skeleton } from "@/components/ui/skeleton";

type ResultStatus = "predicted" | "final" | "live";
type Marker = "advance" | "third" | "none";

const GOAL_DIFF_COLUMN_WIDTH = "1.5rem";
const POINTS_COLUMN_WIDTH = "1.75rem";
const MARKER_COLUMN_WIDTH = "1.25rem";
const SKELETON_ROWS = ["a", "b", "c", "d"];

// Team and result columns each take an equal 1fr share so extra width spreads
// evenly across them; GD/Pts/marker stay fixed and naturally tighter.
export function groupGridColumns(count: number): string {
  return `minmax(5rem, 1.4fr) repeat(${count}, minmax(2.15rem, 1fr)) ${GOAL_DIFF_COLUMN_WIDTH} ${POINTS_COLUMN_WIDTH} ${MARKER_COLUMN_WIDTH}`;
}

interface TeamSummary {
  code: string;
  name?: string;
  confirmed?: boolean;
}

interface GroupCardResult {
  text: string;
  title?: string;
  status: ResultStatus;
}

interface GroupCardRow {
  position: number;
  team: TeamSummary;
  dimmed?: boolean;
  goalDiff: string;
  points: number;
  marker?: Marker;
  cells: Array<GroupCardResult | null | undefined>;
}

type GroupCardProps =
  | { title: string; loading: true }
  | { title: string; loading?: false; columns: string[]; rows: GroupCardRow[] };

function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full bg-rose-400 animate-pulse",
        className,
      )}
    />
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wide text-rose-400 uppercase">
      <LiveDot className="size-1.5" />
      Live
    </span>
  );
}

function ResultCell({ result }: { result: GroupCardResult }) {
  const live = result.status === "live";

  return (
    <div
      className={cn(
        "w-full rounded px-0.5 py-1.5 text-center text-[11px] leading-none tabular-nums whitespace-nowrap select-none",
        live
          ? "font-semibold text-rose-400"
          : result.status === "final"
            ? "font-semibold text-pick"
            : "font-semibold text-foreground/85",
      )}
      title={result.title}
    >
      <span className="relative inline-block rounded px-0.5">
        {live && (
          <span
            aria-hidden
            className="absolute -inset-x-1 -inset-y-0.5 rounded bg-rose-500/10 animate-pulse"
          />
        )}
        <span className="relative">{result.text}</span>
        {live && (
          <LiveDot className="absolute left-full top-1/2 ml-1.5 size-1.5 -translate-y-1/2" />
        )}
      </span>
    </div>
  );
}

function MarkerIcon({ marker }: { marker?: Marker }) {
  if (marker === "advance") {
    return <Check className="size-3 text-pick" strokeWidth={3} />;
  }

  if (marker === "third") {
    return (
      <span className="inline-flex size-3 items-center justify-center text-[13px] font-semibold leading-none text-muted-foreground/60">
        ?
      </span>
    );
  }

  return <X className="size-3 text-muted-foreground/45" />;
}

function GroupCardShell({
  title,
  live,
  children,
}: {
  title: string;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-surface-divider px-3 py-1.5 text-[11px] leading-3 font-medium text-muted-foreground tabular-nums tracking-wide">
        <h3 className="truncate text-left text-foreground/70">{title}</h3>
        {live && <LiveBadge />}
      </div>
      {children}
    </div>
  );
}

export function GroupCard(props: GroupCardProps) {
  // While the data loads the title is already known, so show it for real and
  // skeleton only the standings rows.
  if (props.loading) {
    return (
      <GroupCardShell title={props.title}>
        <div className="animate-pulse space-y-2.5 px-3 py-2.5" aria-hidden>
          {SKELETON_ROWS.map((row) => (
            <Skeleton key={row} className="h-3 w-full" />
          ))}
        </div>
      </GroupCardShell>
    );
  }

  const { title, columns, rows } = props;
  const live = rows.some((row) =>
    row.cells.some((cell) => cell?.status === "live"),
  );

  return (
    <GroupCardShell title={title} live={live}>
      <div
        className="grid items-center gap-x-1 gap-y-1 px-1.5 py-2"
        style={{
          gridTemplateColumns: groupGridColumns(columns.length),
        }}
      >
        <span />
        {columns.map((code) => (
          <span
            key={`head-${code}`}
            className="text-center text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase whitespace-nowrap"
          >
            {code}
          </span>
        ))}
        <span className="text-center text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase whitespace-nowrap">
          GD
        </span>
        <span className="text-center text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase whitespace-nowrap">
          Pts
        </span>
        <span />

        {rows.flatMap((row) => [
          <div
            key={`${row.team.code}:team`}
            className={cn(
              "flex min-w-0 items-center gap-1.5 pr-1",
              row.dimmed && "opacity-45",
            )}
          >
            <span className="w-3 text-right text-[10px] text-muted-foreground tabular-nums">
              {row.position}
            </span>
            <Flag code={row.team.code} size={16} />
            <span
              className={cn(
                "truncate text-[12px] font-semibold tracking-wide",
                row.team.confirmed && "text-pick",
              )}
              title={row.team.name}
            >
              {row.team.code}
            </span>
          </div>,
          ...columns.map((code, index) => {
            const result = row.cells[index];
            return result ? (
              <ResultCell key={`${row.team.code}:${code}`} result={result} />
            ) : (
              <span
                key={`${row.team.code}:${code}`}
                className="flex justify-center"
              >
                <span className="size-1 rounded-full bg-border" />
              </span>
            );
          }),
          <span
            key={`${row.team.code}:gd`}
            className={cn(
              "text-center text-[11px] text-muted-foreground tabular-nums",
              row.dimmed && "opacity-60",
            )}
          >
            {row.goalDiff}
          </span>,
          <span
            key={`${row.team.code}:points`}
            className={cn(
              "text-center text-[12px] font-semibold tabular-nums",
              row.dimmed && "opacity-60",
            )}
          >
            {row.points}
          </span>,
          <span key={`${row.team.code}:marker`} className="flex justify-center">
            <MarkerIcon marker={row.marker} />
          </span>,
        ])}
      </div>
    </GroupCardShell>
  );
}
