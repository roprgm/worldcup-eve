import { cn } from "cnfast";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { Flag } from "@/components/flags";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ResultStatus = "predicted" | "final" | "live";
type Marker = "advance" | "third" | "none";

const GOAL_DIFF_COLUMN_WIDTH = "1.5rem";
const POINTS_COLUMN_WIDTH = "1.75rem";
const MARKER_COLUMN_WIDTH = "1.25rem";
// One label row plus the four team rows — mirrors the real grid's row count.
const SKELETON_ROWS = ["head", "a", "b", "c", "d"];

// Team and result columns each take an equal 1fr share so extra width spreads
// evenly across them; GD/Pts/marker stay fixed and naturally tighter.
export function groupGridColumns(count: number): string {
  return `minmax(5rem, 1.4fr) repeat(${count}, minmax(2.15rem, 1fr)) ${GOAL_DIFF_COLUMN_WIDTH} ${POINTS_COLUMN_WIDTH} ${MARKER_COLUMN_WIDTH}`;
}

interface TeamSummary {
  code: string;
  name?: string;
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
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-rose-400">
      <LiveDot className="size-1.5" />
      Live
    </span>
  );
}

function PredictedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground/45">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-foreground/45"
      />
      Predicted
    </span>
  );
}

function ResultCell({ result }: { result: GroupCardResult }) {
  const live = result.status === "live";
  const predicted = result.status === "predicted";

  return (
    <div
      className={cn(
        "w-full rounded px-0.5 py-1.5 text-center text-xs font-semibold leading-none tabular-nums whitespace-nowrap select-none",
        // Speculative scorelines are a faint grey; confirmed and live ones stay white.
        predicted ? "text-foreground/45" : "text-foreground",
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
        {predicted && (
          <span
            aria-hidden
            className="absolute left-full top-1/2 ml-1.5 size-1.5 -translate-y-1/2 rounded-full bg-foreground/45"
          />
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
      <span className="inline-flex size-3 items-center justify-center text-sm font-semibold leading-none text-muted-foreground/60">
        ?
      </span>
    );
  }

  return <X className="size-3 text-muted-foreground/45" />;
}

function GroupCardShell({
  title,
  live,
  predicted,
  children,
}: {
  title: string;
  live?: boolean;
  predicted?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex h-6 items-center justify-between gap-2 border-b border-surface-divider px-3 text-xs leading-3 font-medium text-muted-foreground tabular-nums tracking-wide">
        <h3 className="truncate text-left text-foreground/70">{title}</h3>
        {(live || predicted) && (
          <div className="flex shrink-0 items-center gap-2.5">
            {predicted && <PredictedBadge />}
            {live && <LiveBadge />}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

export function GroupCard(props: GroupCardProps) {
  // While the data loads the title is already known, so show it for real and
  // skeleton only the standings rows.
  if (props.loading) {
    return (
      <GroupCardShell title={props.title}>
        {/* Same grid geometry as the real card (one label row + four team rows
            at the fixed row height) so the placeholder reserves its exact size. */}
        <div
          className="grid animate-pulse auto-rows-[22px] items-center gap-y-1 px-3 py-2"
          aria-hidden
        >
          {SKELETON_ROWS.map((row, i) => (
            <Skeleton
              key={row}
              className={cn("h-3", i === 0 ? "w-1/3" : "w-full")}
            />
          ))}
        </div>
      </GroupCardShell>
    );
  }

  const { title, columns, rows } = props;
  const live = rows.some((row) =>
    row.cells.some((cell) => cell?.status === "live"),
  );
  const predicted = rows.some((row) =>
    row.cells.some((cell) => cell?.status === "predicted"),
  );

  return (
    <GroupCardShell title={title} live={live} predicted={predicted}>
      <div
        className="grid auto-rows-[22px] items-center gap-x-1 gap-y-1 px-1.5 py-2"
        style={{
          gridTemplateColumns: groupGridColumns(columns.length),
        }}
      >
        <span />
        {columns.map((code) => (
          <span
            key={`head-${code}`}
            className="text-center text-xs leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase whitespace-nowrap"
          >
            {code}
          </span>
        ))}
        <span className="text-center text-xs leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase whitespace-nowrap">
          GD
        </span>
        <span className="text-center text-xs leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase whitespace-nowrap">
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
            <span className="w-3 text-right text-xs text-muted-foreground tabular-nums">
              {row.position}
            </span>
            <Flag code={row.team.code} size={16} />
            <span
              className="truncate text-xs font-semibold tracking-wide"
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
              "text-center text-xs text-muted-foreground tabular-nums",
              row.dimmed && "opacity-60",
            )}
          >
            {row.goalDiff}
          </span>,
          <span
            key={`${row.team.code}:points`}
            className={cn(
              "text-center text-xs font-semibold text-foreground tabular-nums",
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
